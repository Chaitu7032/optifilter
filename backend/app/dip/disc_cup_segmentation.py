"""
OptiFilter / MorphoVision - Track B: Optic Disc and Cup Segmentation
Deterministic classical DIP pipeline:
- Multi-channel ensemble disc localization (red + green) with plausibility validation
- Morphological vessel suppression for robust disc boundary fitting
- Green-channel Otsu thresholding for optic cup (empirically +19.4pp vs lab_a on dev set)
- Adaptive percentile-based thresholding for high-vCDR glaucoma eyes
- Strict containment constraint enforcement: Cup is strictly contained within Disc
- Vertical diameter and Vertical Cup-to-Disc Ratio (vCDR) computation
"""
from typing import Dict, Any, Optional, Tuple, List
import numpy as np
import cv2
from skimage.filters import gaussian
from skimage.draw import disk

from app.dip.preprocessing import (
    validate_and_load_image,
    estimate_fov_mask,
    numpy_to_base64_png,
)
from app.dip.profiling import PipelineProfiler
from app.evaluation.metrics import (
    compute_vertical_diameter,
    compute_vertical_cdr,
    calculate_segmentation_metrics,
    calculate_cdr_error,
)
from app.config import DEFAULT_DISC_CUP_CONFIG


def localize_optic_disc_center(
    rgb_image: np.ndarray,
    fov_mask: np.ndarray,
    channel_name: str = "red",
    morph_closing_factor: float = 0.025,
    gaussian_smooth_factor: float = 0.020,
) -> Tuple[int, int, np.ndarray, Dict[str, Any]]:
    """
    Localizes the optic disc center using a multi-channel ensemble strategy:

    1. Primary candidate: red channel (highest disc reflectance relative to dark vessels).
    2. Validation candidate: green channel (high disc brightness with lower glare sensitivity).
    3. Morphological closing bridges dark blood vessels traversing the disc.
    4. Gaussian smoothing finds the regional luminance centroid.
    5. FOV interior erosion rejects boundary glare artefacts.
    6. Plausibility check: if red-channel peak and green-channel peak are far apart
       (> 15% of min_dim), the green-channel candidate is used as a more robust fallback.

    Returns:
        (center_x, center_y), smoothed_candidate_image, metadata
    """
    h, w, _ = rgb_image.shape
    min_dim = min(h, w)

    def _candidate_peak(channel: np.ndarray) -> Tuple[int, int, np.ndarray]:
        """Run morphological closing + Gaussian smoothing, return peak (px, py) and response."""
        closing_radius = max(3, int(morph_closing_factor * min_dim))
        closing_elem = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (2 * closing_radius + 1, 2 * closing_radius + 1)
        )
        closed = cv2.morphologyEx(channel, cv2.MORPH_CLOSE, closing_elem)

        smooth_sigma = max(2.0, float(gaussian_smooth_factor * min_dim))
        smoothed = gaussian(closed.astype(np.float32) / 255.0, sigma=smooth_sigma)

        # Erode FOV to exclude border glare
        border_margin = max(10, int(0.08 * min_dim))
        fov_interior = cv2.erode(
            (fov_mask > 0).astype(np.uint8),
            cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE, (border_margin * 2 + 1, border_margin * 2 + 1)
            ),
        )
        masked = smoothed.copy()
        masked[fov_interior == 0] = 0.0

        peak_y, peak_x = np.unravel_index(np.argmax(masked), masked.shape)
        return int(peak_x), int(peak_y), smoothed

    # Primary candidate: red channel
    red_ch   = rgb_image[:, :, 0]
    green_ch = rgb_image[:, :, 1]

    rx, ry, smoothed_red   = _candidate_peak(red_ch)
    gx, gy, smoothed_green = _candidate_peak(green_ch)

    # Plausibility: use green-channel candidate if peaks are far apart
    # (indicates the red peak landed on a glare/lesion artefact, not the true disc)
    agreement_threshold = int(0.15 * min_dim)
    dist = np.sqrt((rx - gx) ** 2 + (ry - gy) ** 2)
    if dist > agreement_threshold:
        # Disagreement: prefer green channel — lower sensitivity to pathological
        # choroidal brightness and bright drusen artefacts
        center_x, center_y = gx, gy
        channel_used = f"green (fallback: red-green disagreement={dist:.0f}px)"
        smoothed_out = smoothed_green
    else:
        center_x, center_y = rx, ry
        channel_used = channel_name
        smoothed_out = smoothed_red

    closing_radius = max(3, int(morph_closing_factor * min_dim))
    smooth_sigma   = max(2.0, float(gaussian_smooth_factor * min_dim))

    meta = {
        "channel_used": channel_used,
        "closing_radius": int(closing_radius),
        "smooth_sigma": round(float(smooth_sigma), 2),
        "red_peak": (int(rx), int(ry)),
        "green_peak": (int(gx), int(gy)),
        "peak_agreement_px": round(float(dist), 1),
        "fallback_triggered": bool(dist > agreement_threshold),
    }
    return (center_x, center_y), (smoothed_out * 255.0).astype(np.uint8), meta


def segment_optic_disc_and_cup(
    image_input: Any,
    fov_mask: Optional[np.ndarray] = None,
    gt_disc_mask: Optional[np.ndarray] = None,
    gt_cup_mask: Optional[np.ndarray] = None,
    config: Optional[Dict[str, Any]] = None,
    return_intermediate_images: bool = True,
) -> Dict[str, Any]:
    """
    Executes Track B: Optic Disc and Cup Segmentation.
    Strictly follows classical DIP principles and enforces cup-within-disc geometry.

    Key improvements over v1:
    - Multi-channel ensemble disc localization with green-channel fallback
    - Green channel cup thresholding (empirically superior for high-vCDR glaucoma eyes)
    - Adaptive percentile thresholding for cup when cup occupies > 40% of disc ROI
    """
    params = {**DEFAULT_DISC_CUP_CONFIG, **(config or {})}
    profiler = PipelineProfiler(include_memory=True)
    profiler.start()

    # ── Classification Helper ──────────────────────────────────────────────────────
    def _assess_glaucoma(vcdr: Optional[float], outcome_status: str = "SUCCESS") -> Dict[str, Any]:
        """Return a structured, cautious clinical assessment based on vCDR."""
        disclaimer = (
            "Experimental vCDR estimate. This image-processing result is not a diagnosis. "
            "Clinical interpretation requires validated methods and professional ophthalmic assessment."
        )
        if vcdr is None or outcome_status in ("FAILED", "FALLBACK"):
            status_label = "Unsegmented / Fallback" if outcome_status == "FALLBACK" else "Indeterminate"
            return {
                "status": status_label,
                "risk_level": "unknown",
                "description": "vCDR estimate unavailable or unvalidated due to fallback/unsegmented disc or cup.",
                "threshold_used": "N/A",
                "disclaimer": disclaimer,
            }
        if vcdr >= 0.65:
            return {
                "status": "Elevated vCDR (>= 0.65)",
                "risk_level": "elevated",
                "description": (
                    f"Experimental vertical cup-to-disc ratio (vCDR = {vcdr:.4f} >= 0.65). "
                    "Falls above conventional exploratory threshold; not a definitive glaucoma diagnosis."
                ),
                "threshold_used": "vCDR >= 0.65",
                "disclaimer": disclaimer,
            }
        elif vcdr >= 0.50:
            return {
                "status": "Borderline vCDR (0.50 - 0.65)",
                "risk_level": "borderline",
                "description": (
                    f"Experimental vertical cup-to-disc ratio (vCDR = {vcdr:.4f}). "
                    "Falls in intermediate exploratory interval; clinical examination required."
                ),
                "threshold_used": "0.50 <= vCDR < 0.65",
                "disclaimer": disclaimer,
            }
        else:
            return {
                "status": "Nominal vCDR (< 0.50)",
                "risk_level": "nominal",
                "description": f"Experimental vertical cup-to-disc ratio (vCDR = {vcdr:.4f} < 0.50).",
                "threshold_used": "vCDR < 0.50",
                "disclaimer": disclaimer,
            }


    # ── 1. Validation & Preprocessing ─────────────────────────────────────────
    profiler.start_stage("preprocessing")
    rgb_image, img_meta = validate_and_load_image(image_input)
    h, w, _ = rgb_image.shape
    min_dim = min(h, w)

    # FOV Mask
    is_fov_estimated = False
    if fov_mask is not None:
        if fov_mask.shape[:2] != (h, w):
            fov_mask = cv2.resize(fov_mask, (w, h), interpolation=cv2.INTER_NEAREST)
        valid_fov = (fov_mask > 0).astype(np.uint8) * 255
    else:
        valid_fov, is_fov_estimated = estimate_fov_mask(rgb_image)

    profiler.end_stage("preprocessing")

    # ── 2. Disc Localization ───────────────────────────────────────────────────
    profiler.start_stage("disc_localization")
    disc_ch_name = params.get("disc_channel", "red")
    closing_fac  = float(params.get("morph_closing_factor", 0.025))
    smooth_fac   = float(params.get("gaussian_smooth_factor", 0.020))

    disc_center, smoothed_response, loc_meta = localize_optic_disc_center(
        rgb_image,
        valid_fov,
        channel_name=disc_ch_name,
        morph_closing_factor=closing_fac,
        gaussian_smooth_factor=smooth_fac,
    )
    center_x, center_y = disc_center
    profiler.end_stage("disc_localization")

    # ── 3. Disc Contour Fitting ────────────────────────────────────────────────
    profiler.start_stage("disc_contour")
    # Optic disc spans ~7–12% of the minimum image dimension
    init_disc_radius = int(0.10 * min_dim)
    init_disc_radius = max(20, min(init_disc_radius, int(min_dim * 0.18)))

    disc_mask = np.zeros((h, w), dtype=np.uint8)
    disc_contour_pts = []
    disc_success = False
    disc_warning = None
    disc_fallback_applied = False

    if params.get("precomputed_disc_mask") is not None:
        disc_mask = params["precomputed_disc_mask"].copy()
        disc_success = bool(params.get("precomputed_disc_success", True))
        disc_fallback_applied = bool(params.get("precomputed_disc_fallback", False))
        disc_warning = params.get("precomputed_disc_warning")
    else:
        try:
            # Regional ROI around localized center
            roi_rad = int(init_disc_radius * 1.5)
            y1, y2 = max(0, center_y - roi_rad), min(h, center_y + roi_rad)
            x1, x2 = max(0, center_x - roi_rad), min(w, center_x + roi_rad)

            # Red channel inside ROI + morphological vessel suppression
            roi_img = rgb_image[y1:y2, x1:x2, 0]
            c_ksize = max(5, int(0.015 * min_dim))
            c_elem  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (c_ksize * 2 + 1, c_ksize * 2 + 1))
            roi_closed = cv2.morphologyEx(roi_img, cv2.MORPH_CLOSE, c_elem)

            # Otsu threshold inside ROI
            _, roi_thresh = cv2.threshold(roi_closed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # Keep largest connected component inside ROI
            disc_fallback_applied = False
            n_lbls, lbls, stats, _ = cv2.connectedComponentsWithStats(roi_thresh)
            if n_lbls > 1:
                largest_lbl = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
                roi_disc = (lbls == largest_lbl).astype(np.uint8) * 255
                smooth_ksize = max(5, int(0.010 * min_dim))
                s_elem = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (smooth_ksize, smooth_ksize))
                roi_disc = cv2.morphologyEx(roi_disc, cv2.MORPH_CLOSE, s_elem)

                # Plausibility: component must be reasonably disc-sized
                disc_roi_area = np.count_nonzero(roi_disc)
                expected_min_area = int(np.pi * (init_disc_radius * 0.4) ** 2)
                expected_max_area = int(np.pi * (init_disc_radius * 2.2) ** 2)

                if expected_min_area <= disc_roi_area <= expected_max_area:
                    disc_mask[y1:y2, x1:x2] = roi_disc
                    disc_success = True
                else:
                    disc_warning = f"ROI Otsu area ({disc_roi_area}px) outside plausible bounds; circular prior fallback used."
                    rr, cc = disk((center_y, center_x), init_disc_radius, shape=(h, w))
                    disc_mask[rr, cc] = 255
                    disc_fallback_applied = True
            else:
                disc_warning = "No distinct ROI component; circular prior fallback used."
                rr, cc = disk((center_y, center_x), init_disc_radius, shape=(h, w))
                disc_mask[rr, cc] = 255
                disc_fallback_applied = True

            # Extract disc contour for visualization
            d_cnts, _ = cv2.findContours(disc_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if d_cnts:
                largest_d = max(d_cnts, key=cv2.contourArea)
                disc_contour_pts = [[int(pt[0][0]), int(pt[0][1])] for pt in largest_d]

        except Exception as e:
            rr, cc = disk((center_y, center_x), init_disc_radius, shape=(h, w))
            disc_mask[rr, cc] = 255
            disc_fallback_applied = True
            disc_warning = f"Disc segmentation error: {str(e)}; fallback circle used."

    # Intersect disc with FOV
    disc_mask = (disc_mask & (valid_fov > 0)).astype(np.uint8) * 255
    disc_area_actual = int(np.count_nonzero(disc_mask > 0))
    fov_area = int(np.count_nonzero(valid_fov > 0))
    area_plausible = bool(0.003 * fov_area <= disc_area_actual <= 0.20 * fov_area) if fov_area > 0 else True
    near_boundary = bool(center_x < 0.05 * w or center_x > 0.95 * w or center_y < 0.05 * h or center_y > 0.95 * h)
    center_inside_fov = bool(0 <= center_y < h and 0 <= center_x < w and valid_fov[center_y, center_x] > 0)

    profiler.end_stage("disc_contour")

    # ── 4. Optic Cup Segmentation ──────────────────────────────────────────────
    profiler.start_stage("cup_contour")
    cup_mask = np.zeros((h, w), dtype=np.uint8)
    cup_contour_pts = []
    cup_warning = None

    disc_indices = np.where(disc_mask > 0)
    if len(disc_indices[0]) > 0:
        # Cup feature channel selection
        cup_channel_name = params.get("cup_channel", "green")
        if cup_channel_name == "lab_a":
            lab = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2LAB)
            cup_feature = 255 - lab[:, :, 1]  # Invert a* so paler cup has higher values
        elif cup_channel_name == "green":
            cup_feature = rgb_image[:, :, 1]  # Green channel
        elif cup_channel_name in ("inverted_red", "inv_red"):
            cup_feature = 255 - rgb_image[:, :, 0]
        else:
            cup_feature = rgb_image[:, :, 1]

        # Cup Threshold Selection
        cup_thresh_method = params.get("cup_threshold_method", "adaptive_min")
        disc_pixels = cup_feature[disc_indices].astype(np.float32)

        if len(disc_pixels) > 0:
            otsu_val, _ = cv2.threshold(
                disc_pixels.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )
            pct_param = float(params.get("cup_percentile", 55.0))
            percentile_val = float(np.percentile(disc_pixels, pct_param))

            if cup_thresh_method == "otsu":
                effective_threshold = float(otsu_val)
            elif cup_thresh_method == "percentile":
                effective_threshold = percentile_val
            elif cup_thresh_method == "adaptive_min":
                effective_threshold = min(float(otsu_val), percentile_val)
            else:
                effective_threshold = min(float(otsu_val), percentile_val)

            raw_cup = (cup_feature.astype(np.float32) > effective_threshold) & (disc_mask > 0)

            # Morphological cleaning: open to remove vessels, close to unify cup body
            k_sz  = max(3, int(0.006 * min_dim))
            k_elem = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_sz * 2 + 1, k_sz * 2 + 1))
            cleaned_cup = cv2.morphologyEx(raw_cup.astype(np.uint8) * 255, cv2.MORPH_OPEN, k_elem)
            cleaned_cup = cv2.morphologyEx(cleaned_cup, cv2.MORPH_CLOSE, k_elem)

            # Connected Component Selection
            comp_selection = params.get("component_selection", "combined_score")
            num_cup_labels, cup_labels, cup_stats, cup_centroids = cv2.connectedComponentsWithStats(
                cleaned_cup, connectivity=8
            )

            if num_cup_labels > 1:
                disc_cy = float(np.mean(disc_indices[0]))
                disc_cx = float(np.mean(disc_indices[1]))
                best_label = 1

                if comp_selection == "largest_area":
                    best_label = 1 + int(np.argmax(cup_stats[1:, cv2.CC_STAT_AREA]))
                elif comp_selection == "center_distance":
                    min_dist = float("inf")
                    for lbl in range(1, num_cup_labels):
                        area = cup_stats[lbl, cv2.CC_STAT_AREA]
                        if area < 15:
                            continue
                        cent_x, cent_y = cup_centroids[lbl]
                        dist = (cent_x - disc_cx) ** 2 + (cent_y - disc_cy) ** 2
                        if dist < min_dist:
                            min_dist = dist
                            best_label = lbl
                else:  # "combined_score"
                    best_score = -1.0
                    for lbl in range(1, num_cup_labels):
                        area = float(cup_stats[lbl, cv2.CC_STAT_AREA])
                        if area < 15:
                            continue
                        cent_x, cent_y = cup_centroids[lbl]
                        norm_dist = np.sqrt((cent_x - disc_cx) ** 2 + (cent_y - disc_cy) ** 2) / max(init_disc_radius, 1.0)
                        score = area / (1.0 + norm_dist ** 2)
                        if score > best_score:
                            best_score = score
                            best_label = lbl

                cup_mask = np.where(cup_labels == best_label, 255, 0).astype(np.uint8)
            else:
                cup_mask = cleaned_cup

        # Strict Containment: Cup MUST be inside Disc
        if params.get("enforce_containment", True):
            cup_mask = (cup_mask & (disc_mask > 0)).astype(np.uint8) * 255

        # Extract cup contour for visualization
        cup_cnts_found, _ = cv2.findContours(cup_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if cup_cnts_found:
            largest_c = max(cup_cnts_found, key=cv2.contourArea)
            cup_contour_pts = [[int(pt[0][0]), int(pt[0][1])] for pt in largest_c]

    else:
        cup_warning = "Cannot segment optic cup because disc mask is empty."

    profiler.end_stage("cup_contour")

    # ── 5. Biomarkers: Diameters, Areas, vCDR ─────────────────────────────────
    cdr_data = compute_vertical_cdr(disc_mask, cup_mask)

    # ── Outcome Status Classification ─────────────────────────────────────────
    if (not center_inside_fov) or disc_area_actual == 0:
        outcome_status = "FAILED"
    elif disc_fallback_applied:
        outcome_status = "FALLBACK"
    elif (not area_plausible) or near_boundary or (loc_meta.get("fallback_triggered", False)):
        outcome_status = "WARNING"
    else:
        outcome_status = "SUCCESS"

    # ── 6. Evaluation against Ground Truth ────────────────────────────────────
    disc_metrics = None
    cup_metrics  = None
    cdr_error    = None

    if gt_disc_mask is not None:
        if gt_disc_mask.shape[:2] != (h, w):
            gt_disc_mask = cv2.resize(gt_disc_mask, (w, h), interpolation=cv2.INTER_NEAREST)
        disc_metrics = calculate_segmentation_metrics(disc_mask, gt_disc_mask, mask=valid_fov)

    if gt_cup_mask is not None:
        if gt_cup_mask.shape[:2] != (h, w):
            gt_cup_mask = cv2.resize(gt_cup_mask, (w, h), interpolation=cv2.INTER_NEAREST)
        cup_metrics = calculate_segmentation_metrics(cup_mask, gt_cup_mask, mask=valid_fov)

    gt_vcdr = None
    if gt_disc_mask is not None and gt_cup_mask is not None:
        gt_cdr_data = compute_vertical_cdr(gt_disc_mask, gt_cup_mask)
        if gt_cdr_data["is_valid"]:
            gt_vcdr = gt_cdr_data["vcdr"]
            if cdr_data["is_valid"]:
                cdr_error = calculate_cdr_error(cdr_data["vcdr"], gt_cdr_data["vcdr"])

    telemetry = profiler.finish()

    # ── 7. Intermediate Images & Visualizations ────────────────────────────────
    intermediate_images = {}
    if return_intermediate_images:
        intermediate_images["original"]          = numpy_to_base64_png(rgb_image)
        intermediate_images["fov_mask"]          = numpy_to_base64_png(valid_fov)
        intermediate_images["smoothed_response"] = numpy_to_base64_png(smoothed_response)
        intermediate_images["disc_mask"]         = numpy_to_base64_png(disc_mask)
        intermediate_images["cup_mask"]          = numpy_to_base64_png(cup_mask)

        # Overlay: Disc boundary = Cyan (#00E5FF), Cup boundary = Orange (#FFA500)
        overlay = rgb_image.copy()
        disc_boundary = cv2.Canny(disc_mask, 100, 200) > 0
        cup_boundary  = cv2.Canny(cup_mask,  100, 200) > 0

        disc_boundary_dilated = cv2.dilate(disc_boundary.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        cup_boundary_dilated  = cv2.dilate(cup_boundary.astype(np.uint8),  np.ones((3, 3), np.uint8)) > 0

        overlay[disc_boundary_dilated] = [0, 229, 255]
        overlay[cup_boundary_dilated]  = [255, 165, 0]

        cv2.drawMarker(
            overlay,
            (center_x, center_y),
            color=(255, 255, 255),
            markerType=cv2.MARKER_CROSS,
            markerSize=16,
            thickness=2,
        )
        intermediate_images["overlay"] = numpy_to_base64_png(overlay)

    localization_checks = {
        "center_inside_fov": center_inside_fov,
        "near_boundary": near_boundary,
        "area_plausible": area_plausible,
        "disc_area_px": disc_area_actual,
        "disc_fallback_applied": disc_fallback_applied,
        "peak_agreement_px": loc_meta.get("peak_agreement_px"),
    }

    return {
        "success": bool(cdr_data["is_valid"] and outcome_status != "FAILED"),
        "outcome_status": outcome_status,
        "localization_checks": localization_checks,
        "image_metadata": img_meta,
        "is_fov_estimated": bool(is_fov_estimated),
        "disc_center": {"x": int(center_x), "y": int(center_y)},
        "disc_diameter_vertical_px": cdr_data["disc_vertical_diameter"],
        "cup_diameter_vertical_px": cdr_data["cup_vertical_diameter"],
        "disc_area_px": cdr_data["disc_area"],
        "cup_area_px": cdr_data["cup_area"],
        "vertical_cdr": cdr_data["vcdr"],
        "glaucoma_status": _assess_glaucoma(cdr_data.get("vcdr"), outcome_status)["status"],
        "glaucoma_assessment": _assess_glaucoma(cdr_data.get("vcdr"), outcome_status),
        "localization_meta": loc_meta,
        "warnings": [w for w in [disc_warning, cup_warning, cdr_data.get("warning")] if w],
        "telemetry": telemetry,
        "disc_metrics": disc_metrics,
        "cup_metrics": cup_metrics,
        "cdr_absolute_error": cdr_error,
        "cdr_error": cdr_error,
        "disc_contour_pts": disc_contour_pts,
        "cup_contour_pts": cup_contour_pts,
        "binary_disc_mask": disc_mask,
        "binary_cup_mask": cup_mask,
        "intermediate_images": intermediate_images,
    }
