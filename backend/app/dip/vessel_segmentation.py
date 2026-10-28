"""
OptiFilter / MorphoVision - Track A: Retinal Vessel Segmentation
Deterministic classical DIP pipeline:
- Green channel extraction
- Contrast Limited Adaptive Histogram Equalization (CLAHE)
- Multiscale Frangi vesselness filter with explicit ridge polarity
- Percentile-based hysteresis thresholding inside FOV
- Connected component noise pruning and vessel density calculation
"""
from typing import Dict, Any, Optional, List, Tuple
import numpy as np
import cv2
from skimage.filters import frangi, apply_hysteresis_threshold, threshold_otsu
import matplotlib.cm as cm

from app.dip.preprocessing import (
    validate_and_load_image,
    extract_green_channel,
    apply_clahe,
    apply_gaussian_denoising,
    estimate_fov_mask,
    numpy_to_base64_png,
)
from app.dip.profiling import PipelineProfiler
from app.config import DEFAULT_VESSEL_CONFIG


def segment_retinal_vessels(
    image_input: Any,
    fov_mask: Optional[np.ndarray] = None,
    config: Optional[Dict[str, Any]] = None,
    return_intermediate_images: bool = True,
) -> Dict[str, Any]:
    """
    Executes the classical retinal vessel segmentation pipeline.
    
    Args:
        image_input: File path, bytes, or numpy array of RGB fundus image.
        fov_mask: Optional binary FOV mask (H, W). If None, estimated automatically.
        config: Custom hyperparameter dictionary overriding DEFAULT_VESSEL_CONFIG.
        return_intermediate_images: If True, encodes intermediate stages as base64 PNGs.
        
    Returns:
        Structured dictionary with binary mask, vessel density, stage timings, and telemetry.
    """
    params = {**DEFAULT_VESSEL_CONFIG, **(config or {})}
    profiler = PipelineProfiler(include_memory=True)
    profiler.start()

    # 1. Validation & Preprocessing
    profiler.start_stage("preprocessing")
    rgb_image, img_meta = validate_and_load_image(image_input)
    h, w, _ = rgb_image.shape

    # Handle FOV Mask
    is_fov_estimated = False
    if fov_mask is not None:
        if fov_mask.shape[:2] != (h, w):
            fov_mask = cv2.resize(fov_mask, (w, h), interpolation=cv2.INTER_NEAREST)
        valid_fov = (fov_mask > 0).astype(np.uint8) * 255
    else:
        valid_fov, is_fov_estimated = estimate_fov_mask(rgb_image)

    # Green channel extraction
    green = extract_green_channel(rgb_image)

    # Optional Gaussian Denoise
    sigma_denoise = float(params.get("gaussian_denoise_sigma", 0.5))
    if sigma_denoise > 0:
        denoised_green = apply_gaussian_denoising(green, sigma=sigma_denoise)
    else:
        denoised_green = green

    # CLAHE Enhancement
    use_clahe = bool(params.get("use_clahe", True))
    if use_clahe:
        clip_limit = float(params.get("clahe_clip_limit", 2.0))
        grid_size = int(params.get("clahe_tile_grid_size", 8))
        enhanced_image = apply_clahe(denoised_green, clip_limit=clip_limit, tile_grid_size=grid_size)
    else:
        enhanced_image = denoised_green

    profiler.end_stage("preprocessing")

    # 2. Multiscale Frangi Vesselness Filter
    profiler.start_stage("vesselness")
    sigmas_list = params.get("frangi_sigmas", [1.0, 1.5, 2.0, 3.0, 4.0])
    if isinstance(sigmas_list, (int, float)):
        sigmas_list = [float(sigmas_list)]
    sigmas_tuple = tuple(float(s) for s in sigmas_list)

    alpha = float(params.get("frangi_alpha", 0.5))
    beta = float(params.get("frangi_beta", 0.5))
    gamma = float(params.get("frangi_gamma", 15.0))

    # In fundus green channel, blood vessels appear darker than the retina.
    # We set black_ridges=True to detect dark tubular structures.
    # Normalize enhanced_image to [0, 1] float for numerical stability
    norm_img = enhanced_image.astype(np.float32) / 255.0
    vesselness = frangi(
        norm_img,
        sigmas=sigmas_tuple,
        alpha=alpha,
        beta=beta,
        gamma=gamma,
        black_ridges=True,
    )

    # Zero-out response outside valid FOV to prevent border gradient spikes
    fov_bool = valid_fov > 0
    vesselness[~fov_bool] = 0.0

    # Normalize vesselness to [0, 1] range inside FOV
    fov_responses = vesselness[fov_bool]
    if len(fov_responses) > 0 and np.max(fov_responses) > 0:
        vesselness_norm = np.zeros_like(vesselness)
        v_min, v_max = np.min(fov_responses), np.max(fov_responses)
        vesselness_norm[fov_bool] = (vesselness[fov_bool] - v_min) / (v_max - v_min + 1e-12)
    else:
        vesselness_norm = vesselness.copy()

    profiler.end_stage("vesselness")

    # 3. Thresholding & Binary Vessel Mask Generation
    profiler.start_stage("thresholding")
    threshold_method = params.get("threshold_method", "hysteresis")
    binary_mask = np.zeros((h, w), dtype=np.uint8)

    valid_vals = vesselness_norm[fov_bool]
    if len(valid_vals) > 0:
        if threshold_method == "global_otsu":
            val_8u = (vesselness_norm * 255.0).astype(np.uint8)
            otsu_thresh, _ = cv2.threshold(val_8u[fov_bool], 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            binary_mask = (val_8u >= otsu_thresh) & fov_bool
            threshold_info = {"method": "global_otsu", "threshold_value_8u": int(otsu_thresh)}

        elif threshold_method == "global_percentile":
            pct = float(params.get("hysteresis_high_percentile", 90.0))
            thresh_val = float(np.percentile(valid_vals, pct))
            binary_mask = (vesselness_norm >= thresh_val) & fov_bool
            threshold_info = {"method": "global_percentile", "percentile": pct, "threshold_value": thresh_val}

        else:  # Default: hysteresis thresholding
            low_pct = float(params.get("hysteresis_low_percentile", 75.0))
            high_pct = float(params.get("hysteresis_high_percentile", 92.0))
            # Ensure low <= high
            if low_pct > high_pct:
                low_pct, high_pct = high_pct, low_pct

            low_thresh = float(np.percentile(valid_vals, low_pct))
            high_thresh = float(np.percentile(valid_vals, high_pct))

            hyst_result = apply_hysteresis_threshold(vesselness_norm, low_thresh, high_thresh)
            binary_mask = hyst_result & fov_bool
            threshold_info = {
                "method": "hysteresis",
                "low_percentile": low_pct,
                "high_percentile": high_pct,
                "low_threshold": round(low_thresh, 5),
                "high_threshold": round(high_thresh, 5),
            }
    else:
        threshold_info = {"method": threshold_method, "warning": "Empty FOV pixels"}

    # 4. Small Component Noise Pruning
    min_comp_size = int(params.get("min_component_size", 25))
    if min_comp_size > 0 and np.any(binary_mask):
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
            binary_mask.astype(np.uint8), connectivity=8
        )
        cleaned_mask = np.zeros_like(binary_mask, dtype=bool)
        for label_idx in range(1, num_labels):
            if stats[label_idx, cv2.CC_STAT_AREA] >= min_comp_size:
                cleaned_mask[labels == label_idx] = True
        binary_mask = cleaned_mask

    binary_mask_uint8 = (binary_mask.astype(np.uint8) * 255)
    profiler.end_stage("thresholding")

    # 5. Measurements & Telemetry
    fov_pixel_count = int(np.count_nonzero(fov_bool))
    vessel_pixel_count = int(np.count_nonzero(binary_mask))
    vessel_density = float(vessel_pixel_count / fov_pixel_count) if fov_pixel_count > 0 else 0.0

    # ── Mask-Derived Vessel Density Statistic ─────────────────────────────────
    density_pct = round(vessel_density * 100, 2)
    dr_disclaimer = (
        "Mask-derived image statistic. This exploratory measurement does not infer clinical "
        "diabetic retinopathy, ischemia, or vascular perfusion status. Clinical assessment requires validated ophthalmic diagnostics."
    )
    if vessel_density < 0.08:
        dr_status = "Sub-nominal vessel density (< 8.0%)"
        dr_risk = "low_density"
        dr_desc = (
            f"Mask-derived vessel density ({density_pct}%) falls below standard 8.0% - 16.0% exploratory reference window. "
            "May reflect reduced vascular caliber, peripheral illumination drop, or low photographic contrast."
        )
        dr_thresh = "vessel density < 8.0%"
    elif vessel_density > 0.16:
        dr_status = "Elevated vessel density (> 16.0%)"
        dr_risk = "high_density"
        dr_desc = (
            f"Mask-derived vessel density ({density_pct}%) exceeds 16.0%. "
            "May indicate high vascular complexity or localized segmentation false positives."
        )
        dr_thresh = "vessel density > 16.0%"
    else:
        dr_status = "Nominal vessel density (8.0% - 16.0%)"
        dr_risk = "nominal"
        dr_desc = f"Mask-derived vessel density ({density_pct}%) falls within standard exploratory fundus range (8.0% - 16.0%)."
        dr_thresh = "8.0% <= vessel density <= 16.0%"

    dr_assessment = {
        "status": dr_status,
        "risk_level": dr_risk,
        "vessel_density_pct": density_pct,
        "description": dr_desc,
        "threshold_used": dr_thresh,
        "disclaimer": dr_disclaimer,
    }

    telemetry = profiler.finish()

    # 6. Visualization & Intermediate Image Generation
    intermediate_images = {}
    if return_intermediate_images:
        # Original Image
        intermediate_images["original"] = numpy_to_base64_png(rgb_image)
        # Green Channel
        intermediate_images["green_channel"] = numpy_to_base64_png(green)
        # CLAHE Enhanced
        intermediate_images["clahe_enhanced"] = numpy_to_base64_png(enhanced_image)
        # FOV Mask
        intermediate_images["fov_mask"] = numpy_to_base64_png(valid_fov)
        
        # Frangi Vesselness Heatmap (inferno / viridis colormap)
        heatmap_float = (vesselness_norm * 255.0).astype(np.uint8)
        heatmap_colored = cv2.applyColorMap(heatmap_float, cv2.COLORMAP_INFERNO)
        heatmap_rgb = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)
        # Blacken outside FOV
        heatmap_rgb[~fov_bool] = 0
        intermediate_images["frangi_heatmap"] = numpy_to_base64_png(heatmap_rgb)

        # Binary Mask
        intermediate_images["binary_mask"] = numpy_to_base64_png(binary_mask_uint8)

        # High-contrast Overlay on Original: vessels in emerald-green (#00FF66 / rgb(0, 255, 100))
        overlay = rgb_image.copy()
        vessel_indices = binary_mask > 0
        overlay[vessel_indices] = [0, 255, 100]
        intermediate_images["overlay"] = numpy_to_base64_png(overlay)

    return {
        "success": True,
        "image_metadata": img_meta,
        "is_fov_estimated": is_fov_estimated,
        "fov_pixel_count": fov_pixel_count,
        "vessel_pixel_count": vessel_pixel_count,
        "vessel_density": round(vessel_density, 4),
        "dr_status": dr_status,
        "dr_assessment": dr_assessment,
        "threshold_info": threshold_info,
        "parameters": params,
        "telemetry": telemetry,
        "binary_mask": binary_mask_uint8,
        "intermediate_images": intermediate_images,
    }
