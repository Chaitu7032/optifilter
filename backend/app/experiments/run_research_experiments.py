"""
OptiFilter / MorphoVision - Rigorous Research-Readiness Experiment Runner
Executes:
- Track A Frangi Sigma Sweep (1.5, 2.0, 2.5, 3.0 vs multiscale)
- Track A Full Ablation Study (CLAHE, single/multi, hysteresis, component pruning, baselines)
- Track B Key Failure Diagnostics & Overlays (drishtiGS_010, 026, 032, 037, 040, 041, 068, 080, 081, 101, 018)
- Track B Controlled Experiments (cup channels, thresholding, component selection)
- Constant-CDR Baseline & Bland-Altman Agreement Analysis
- High-Precision CPU & Memory Runtime Benchmarking
- Independent Evaluation on Official Test Sets
"""
import time
import json
import platform
import tracemalloc
import sys
from pathlib import Path
from datetime import datetime
import cv2
import numpy as np
import pandas as pd
from PIL import Image
from scipy import stats

from app.config import (
    BASE_DIR,
    DATASETS_DIR,
    MANIFESTS_DIR,
    DEFAULT_VESSEL_CONFIG,
    DEFAULT_DISC_CUP_CONFIG,
)
from app.evaluation.dataset_adapters import DriveAdapter, DrishtiGSAdapter
from app.dip.vessel_segmentation import segment_retinal_vessels
from app.dip.disc_cup_segmentation import segment_optic_disc_and_cup
from app.evaluation.metrics import (
    compute_confusion_matrix,
    calculate_segmentation_metrics,
    compute_vertical_cdr,
    calculate_cdr_error,
    compute_bland_altman,
    compute_cdr_summary_statistics,
    aggregate_statistics,
)

OUTPUT_DIR = BASE_DIR / "research_outputs"
FAILURE_DIR = OUTPUT_DIR / "failure_analysis"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FAILURE_DIR.mkdir(parents=True, exist_ok=True)


def get_hardware_info():
    return {
        "processor": platform.processor(),
        "machine": platform.machine(),
        "platform": platform.platform(),
        "python_version": sys.version.split()[0],
    }


# ==============================================================================
# STEP 6: TRACK A CONTROLLED EXPERIMENTS (DRIVE)
# ==============================================================================
def run_track_a_sigma_sweep(adapter: DriveAdapter, dev_items: list):
    """
    Evaluates single-scale Frangi (sigmas = 1.5, 2.0, 2.5, 3.0) versus multiscale
    on DRIVE development split (15 images).
    """
    print("\n--- Running Track A: Frangi Sigma Sweep ---")
    configs = {
        "single_sigma_1.5": {"frangi_sigmas": [1.5]},
        "single_sigma_2.0": {"frangi_sigmas": [2.0]},
        "single_sigma_2.5": {"frangi_sigmas": [2.5]},
        "single_sigma_3.0": {"frangi_sigmas": [3.0]},
        "multiscale_default": {"frangi_sigmas": [1.0, 1.5, 2.0, 3.0, 4.0]},
    }

    per_image_rows = []
    summary_rows = []

    for cfg_name, cfg_override in configs.items():
        cfg = {**DEFAULT_VESSEL_CONFIG, **cfg_override}
        dices, ious, senss, specs, precs, runtimes = [], [], [], [], [], []

        for item in dev_items:
            loaded = adapter.load_item(item)
            rgb = loaded["rgb_image"]
            fov = loaded["fov_mask"]
            gt = loaded["vessel_gt"]
            raw_id = item.get("raw_id", item["id"])

            t0 = time.perf_counter()
            res = segment_retinal_vessels(rgb, fov_mask=fov, config=cfg, return_intermediate_images=False)
            lat_ms = (time.perf_counter() - t0) * 1000.0

            pred = res["binary_mask"]
            tp, fp, fn, tn = compute_confusion_matrix(pred, gt, mask=fov)
            m = calculate_segmentation_metrics(pred, gt, mask=fov)

            row = {
                "experiment": "sigma_sweep",
                "configuration": cfg_name,
                "image_id": raw_id,
                "dice": m["dice"],
                "iou": m["iou"],
                "sensitivity": m["sensitivity"],
                "specificity": m["specificity"],
                "precision": m["precision"],
                "accuracy": m["accuracy"],
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "tn": tn,
                "runtime_ms": round(lat_ms, 2),
            }
            per_image_rows.append(row)

            dices.append(m["dice"])
            ious.append(m["iou"])
            senss.append(m["sensitivity"])
            specs.append(m["specificity"])
            precs.append(m["precision"])
            runtimes.append(lat_ms)

        stats_dice = aggregate_statistics(np.array(dices))
        stats_iou = aggregate_statistics(np.array(ious))
        stats_sens = aggregate_statistics(np.array(senss))
        stats_spec = aggregate_statistics(np.array(specs))
        stats_prec = aggregate_statistics(np.array(precs))
        stats_rt = aggregate_statistics(np.array(runtimes))

        summary_rows.append({
            "configuration": cfg_name,
            "mean_dice": stats_dice["mean"],
            "std_dice": stats_dice["std"],
            "median_dice": stats_dice["median"],
            "iqr_dice": stats_dice["iqr"],
            "mean_iou": stats_iou["mean"],
            "mean_sensitivity": stats_sens["mean"],
            "mean_specificity": stats_spec["mean"],
            "mean_precision": stats_prec["mean"],
            "mean_runtime_ms": stats_rt["mean"],
            "median_runtime_ms": stats_rt["median"],
        })

    df_per_image = pd.DataFrame(per_image_rows)
    df_summary = pd.DataFrame(summary_rows)

    df_per_image.to_csv(OUTPUT_DIR / "track_a_sigma_sweep_per_image.csv", index=False)
    df_summary.to_csv(OUTPUT_DIR / "track_a_sigma_sweep_summary.csv", index=False)
    print("Sigma sweep completed.")
    print(df_summary[["configuration", "mean_dice", "mean_iou", "mean_sensitivity", "mean_specificity", "mean_runtime_ms"]])
    return df_summary, df_per_image


def run_track_a_ablation_study(adapter: DriveAdapter, dev_items: list):
    """
    Evaluates:
    - Baseline (CLAHE + Multiscale + Hysteresis + Component Pruning)
    - No CLAHE (Raw Green Channel)
    - Single-Scale Frangi (sigma=2.0)
    - No Hysteresis (Fixed-percentile threshold at 90th percentile)
    - No Small-Component Removal (min_component_size = 0)
    - Fair Fixed-Percentile Baseline (88th percentile)
    - Naive Otsu Baseline (directly on raw unscaled Frangi)
    - Transformed-Response Baseline (Log-transformed Frangi + Otsu)
    """
    print("\n--- Running Track A: Complete Ablation Study ---")
    ablations = {
        "Full Baseline": {},
        "No CLAHE (Raw Green)": {"use_clahe": False},
        "Single-Scale Frangi (sigma=2.0)": {"frangi_sigmas": [2.0]},
        "No Hysteresis (Percentile 90)": {"threshold_method": "global_percentile", "hysteresis_high_percentile": 90.0},
        "No Small-Component Removal": {"min_component_size": 0},
        "Fair Fixed-Percentile (P88)": {"threshold_method": "global_percentile", "hysteresis_high_percentile": 88.0},
        "Naive Otsu (Raw Response)": {"threshold_method": "global_otsu"},
    }

    per_image_rows = []
    summary_rows = []

    for name, overrides in ablations.items():
        cfg = {**DEFAULT_VESSEL_CONFIG, **overrides}
        dices, ious, senss, specs, precs, rts = [], [], [], [], [], []

        for item in dev_items:
            loaded = adapter.load_item(item)
            rgb = loaded["rgb_image"]
            fov = loaded["fov_mask"]
            gt = loaded["vessel_gt"]
            raw_id = item.get("raw_id", item["id"])

            t0 = time.perf_counter()
            res = segment_retinal_vessels(rgb, fov_mask=fov, config=cfg, return_intermediate_images=False)
            lat_ms = (time.perf_counter() - t0) * 1000.0

            pred = res["binary_mask"]
            tp, fp, fn, tn = compute_confusion_matrix(pred, gt, mask=fov)
            m = calculate_segmentation_metrics(pred, gt, mask=fov)

            per_image_rows.append({
                "ablation_variant": name,
                "image_id": raw_id,
                "dice": m["dice"],
                "iou": m["iou"],
                "sensitivity": m["sensitivity"],
                "specificity": m["specificity"],
                "precision": m["precision"],
                "accuracy": m["accuracy"],
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "tn": tn,
                "runtime_ms": round(lat_ms, 2),
            })

            dices.append(m["dice"])
            ious.append(m["iou"])
            senss.append(m["sensitivity"])
            specs.append(m["specificity"])
            precs.append(m["precision"])
            rts.append(lat_ms)

        st_d = aggregate_statistics(np.array(dices))
        st_i = aggregate_statistics(np.array(ious))
        st_s = aggregate_statistics(np.array(senss))
        st_sp = aggregate_statistics(np.array(specs))
        st_pr = aggregate_statistics(np.array(precs))
        st_rt = aggregate_statistics(np.array(rts))

        summary_rows.append({
            "variant": name,
            "mean_dice": st_d["mean"],
            "std_dice": st_d["std"],
            "median_dice": st_d["median"],
            "iqr_dice": st_d["iqr"],
            "mean_iou": st_i["mean"],
            "mean_sensitivity": st_s["mean"],
            "mean_specificity": st_sp["mean"],
            "mean_precision": st_pr["mean"],
            "mean_runtime_ms": st_rt["mean"],
        })

    df_summary = pd.DataFrame(summary_rows)
    df_per_image = pd.DataFrame(per_image_rows)

    df_summary.to_csv(OUTPUT_DIR / "track_a_ablation_summary.csv", index=False)
    df_per_image.to_csv(OUTPUT_DIR / "track_a_ablation_per_image.csv", index=False)

    print("Track A ablation study completed.")
    print(df_summary[["variant", "mean_dice", "mean_iou", "mean_sensitivity", "mean_specificity", "mean_runtime_ms"]])
    return df_summary, df_per_image


# ==============================================================================
# STEP 7: TRACK B DIAGNOSTICS & CONTROLLED EXPERIMENTS (DRISHTI-GS)
# ==============================================================================
def run_track_b_failure_diagnostics(adapter: DrishtiGSAdapter):
    """
    Detailed forensic diagnosis for the 11 target failure cases:
    drishtiGS_010, 026, 032, 037, 040, 041, 068, 080, 081, 101, 018
    Generates annotated side-by-side diagnostic figures and CSV table.
    """
    print("\n--- Running Track B Failure Analysis on 11 Target Cases ---")
    target_ids = [
        "drishtiGS_010", "drishtiGS_026", "drishtiGS_032", "drishtiGS_037",
        "drishtiGS_040", "drishtiGS_041", "drishtiGS_068", "drishtiGS_080",
        "drishtiGS_081", "drishtiGS_101", "drishtiGS_018"
    ]

    records = []
    all_items = adapter.get_images("all")

    for raw_id in target_ids:
        item = next((it for it in all_items if it.get("raw_id") == raw_id), None)
        if not item:
            print(f"Warning: {raw_id} not found in Drishti-GS adapter.")
            continue

        loaded = adapter.load_item(item)
        rgb = loaded["rgb_image"]
        d_gt = loaded["disc_gt"]
        c_gt = loaded["cup_gt"]
        ref_vcdr = loaded.get("ref_vcdr")
        split = item.get("split")

        # Ground truth geometric properties
        gt_disc_indices = np.where(d_gt > 0)
        gt_disc_cy = float(np.mean(gt_disc_indices[0])) if len(gt_disc_indices[0]) > 0 else 0.0
        gt_disc_cx = float(np.mean(gt_disc_indices[1])) if len(gt_disc_indices[1]) > 0 else 0.0
        gt_cdr_info = compute_vertical_cdr(d_gt, c_gt)
        gt_vcdr = gt_cdr_info.get("vcdr")

        # Run v1 baseline (Lab a*, pure Otsu, center_distance component selection)
        cfg_v1 = {**DEFAULT_DISC_CUP_CONFIG, "cup_channel": "lab_a", "cup_threshold_method": "otsu", "component_selection": "center_distance"}
        res_v1 = segment_optic_disc_and_cup(rgb, gt_disc_mask=d_gt, gt_cup_mask=c_gt, config=cfg_v1, return_intermediate_images=False)

        # Run candidate method (Green channel, adaptive_min threshold, combined_score component selection)
        cfg_cand = {**DEFAULT_DISC_CUP_CONFIG, "cup_channel": "green", "cup_threshold_method": "adaptive_min", "component_selection": "combined_score"}
        res_cand = segment_optic_disc_and_cup(rgb, gt_disc_mask=d_gt, gt_cup_mask=c_gt, config=cfg_cand, return_intermediate_images=False)

        # Failure classification
        loc_dist = np.sqrt((res_v1["disc_center"]["x"] - gt_disc_cx) ** 2 + (res_v1["disc_center"]["y"] - gt_disc_cy) ** 2)
        disc_dice = res_v1["disc_metrics"]["dice"] if res_v1["disc_metrics"] else 0.0

        if disc_dice < 0.80 or loc_dist > 80.0:
            category = "DISC_LOCALIZATION_OR_FITTING_FAILURE"
            explanation = f"Disc localization/fitting degraded (Disc Dice={disc_dice:.3f}, loc error={loc_dist:.1f}px)."
        elif res_v1["cup_metrics"] and res_v1["cup_metrics"]["dice"] < 0.15:
            category = "CUP_COMPONENT_OR_CONTRAST_FAILURE"
            explanation = "Cup fragmented or lost; severe contrast loss or component mis-selection."
        else:
            category = "GRADIENT_OR_RIM_SLOPE_UNCERTAINTY"
            explanation = "Moderate contour deviation due to sloping neuroretinal rim transition."

        rec = {
            "image_id": raw_id,
            "split": split,
            "gt_disc_center": f"({int(gt_disc_cx)},{int(gt_disc_cy)})",
            "pred_disc_center": f"({res_v1['disc_center']['x']},{res_v1['disc_center']['y']})",
            "loc_error_px": round(loc_dist, 1),
            "disc_dice": disc_dice,
            "outcome_status": res_cand["outcome_status"],
            "fallback_applied": res_cand["localization_checks"]["disc_fallback_applied"],
            "v1_cup_dice": res_v1["cup_metrics"]["dice"] if res_v1["cup_metrics"] else None,
            "v1_pred_vcdr": res_v1["vertical_cdr"],
            "v1_cdr_error_vs_expert": calculate_cdr_error(res_v1["vertical_cdr"], ref_vcdr),
            "candidate_cup_dice": res_cand["cup_metrics"]["dice"] if res_cand["cup_metrics"] else None,
            "candidate_pred_vcdr": res_cand["vertical_cdr"],
            "candidate_cdr_error_vs_expert": calculate_cdr_error(res_cand["vertical_cdr"], ref_vcdr),
            "expert_ref_vcdr": ref_vcdr,
            "mask_gt_vcdr": gt_vcdr,
            "failure_category": category,
            "root_cause_explanation": explanation,
        }
        records.append(rec)

        # Generate diagnostic figure (side-by-side: Image + GT Contours vs Candidate Contours)
        h, w = rgb.shape[:2]
        vis = rgb.copy()
        # Draw GT: Disc in Green, Cup in Blue
        gt_d_cnts, _ = cv2.findContours(d_gt, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        gt_c_cnts, _ = cv2.findContours(c_gt, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(vis, gt_d_cnts, -1, (0, 255, 0), 3)  # GT Disc = Green
        cv2.drawContours(vis, gt_c_cnts, -1, (255, 100, 0), 3)  # GT Cup = Blue

        # Draw Prediction: Disc in Cyan, Cup in Orange
        pred_d_cnts, _ = cv2.findContours(res_cand["binary_disc_mask"], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        pred_c_cnts, _ = cv2.findContours(res_cand["binary_cup_mask"], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(vis, pred_d_cnts, -1, (0, 229, 255), 3)  # Pred Disc = Cyan
        cv2.drawContours(vis, pred_c_cnts, -1, (0, 165, 255), 3)  # Pred Cup = Orange

        # Crop around disc region for clear inspection
        cx, cy = res_cand["disc_center"]["x"], res_cand["disc_center"]["y"]
        rad = int(max(h, w) * 0.18)
        y1, y2 = max(0, cy - rad), min(h, cy + rad)
        x1, x2 = max(0, cx - rad), min(w, cx + rad)
        crop = vis[y1:y2, x1:x2]

        cv2.imwrite(str(FAILURE_DIR / f"diagnostic_overlay_{raw_id}.png"), cv2.cvtColor(crop, cv2.COLOR_RGB2BGR))

    df_diag = pd.DataFrame(records)
    df_diag.to_csv(OUTPUT_DIR / "track_b_failure_diagnostics_verified.csv", index=False)
    print("Track B failure diagnostics completed and saved.")
    return df_diag


def run_track_b_controlled_experiments(adapter: DrishtiGSAdapter, dev_items: list):
    """
    Executes controlled experiments on Drishti-GS development set (35 images):
    1. Channel comparison: Lab a* vs Green channel vs Inverted Red
    2. Threshold method: Otsu vs Adaptive Min vs Percentile
    3. Component selection: Center Distance vs Largest Area vs Combined Score
    """
    print("\n--- Running Track B Controlled Experiments on Development Set ---")

    print("Pre-segmenting optic disc once per development image...")
    disc_cache = {}
    for item in dev_items:
        loaded = adapter.load_item(item)
        rgb = loaded["rgb_image"]
        d_gt = loaded["disc_gt"]
        raw_id = item.get("raw_id", item["id"])
        res_disc = segment_optic_disc_and_cup(rgb, gt_disc_mask=d_gt, config=DEFAULT_DISC_CUP_CONFIG, return_intermediate_images=False)
        disc_cache[raw_id] = {
            "disc_mask": res_disc["binary_disc_mask"],
            "disc_metrics": res_disc["disc_metrics"],
            "outcome_status": res_disc["outcome_status"],
            "disc_fallback_applied": res_disc["localization_checks"]["disc_fallback_applied"],
            "disc_warning": res_disc["warnings"][0] if res_disc["warnings"] else None,
        }
    print(f"Pre-segmentation cached for {len(disc_cache)} development images.")

    experiments = {
        "Exp1_Channel_Lab_a*": {"cup_channel": "lab_a", "cup_threshold_method": "otsu", "component_selection": "center_distance"},
        "Exp1_Channel_Green": {"cup_channel": "green", "cup_threshold_method": "otsu", "component_selection": "center_distance"},
        "Exp1_Channel_InvRed": {"cup_channel": "inverted_red", "cup_threshold_method": "otsu", "component_selection": "center_distance"},
        "Exp2_Thresh_AdaptiveMin": {"cup_channel": "green", "cup_threshold_method": "adaptive_min", "component_selection": "center_distance"},
        "Exp2_Thresh_Percentile55": {"cup_channel": "green", "cup_threshold_method": "percentile", "component_selection": "center_distance"},
        "Exp3_Comp_LargestArea": {"cup_channel": "green", "cup_threshold_method": "adaptive_min", "component_selection": "largest_area"},
        "Exp3_Comp_CombinedScore": {"cup_channel": "green", "cup_threshold_method": "adaptive_min", "component_selection": "combined_score"},
    }

    per_image_records = []
    summary_records = []

    for exp_name, exp_cfg in experiments.items():
        cfg = {**DEFAULT_DISC_CUP_CONFIG, **exp_cfg}
        disc_dices, cup_dices, cdr_errs_expert, cdr_errs_mask = [], [], [], []
        fallback_count = 0
        rts = []

        for item in dev_items:
            loaded = adapter.load_item(item)
            rgb = loaded["rgb_image"]
            d_gt = loaded["disc_gt"]
            c_gt = loaded["cup_gt"]
            ref_vcdr = loaded.get("ref_vcdr")
            raw_id = item.get("raw_id", item["id"])

            disc_info = disc_cache[raw_id]
            cfg_run = {
                **cfg,
                "precomputed_disc_mask": disc_info["disc_mask"],
                "precomputed_disc_fallback": disc_info["disc_fallback_applied"],
                "precomputed_disc_warning": disc_info["disc_warning"],
            }

            t0 = time.perf_counter()
            res = segment_optic_disc_and_cup(rgb, gt_disc_mask=d_gt, gt_cup_mask=c_gt, config=cfg_run, return_intermediate_images=False)
            lat_ms = (time.perf_counter() - t0) * 1000.0

            d_dice = disc_info["disc_metrics"]["dice"] if disc_info["disc_metrics"] else 0.0
            c_dice = res["cup_metrics"]["dice"] if res["cup_metrics"] else 0.0
            err_exp = calculate_cdr_error(res["vertical_cdr"], ref_vcdr)
            err_mask = res["cdr_absolute_error"]

            if res["outcome_status"] == "FALLBACK":
                fallback_count += 1

            per_image_records.append({
                "experiment": exp_name,
                "image_id": raw_id,
                "disc_dice": d_dice,
                "cup_dice": c_dice,
                "pred_vcdr": res["vertical_cdr"],
                "expert_ref_vcdr": ref_vcdr,
                "cdr_error_vs_expert": err_exp,
                "cdr_error_vs_mask": err_mask,
                "outcome_status": res["outcome_status"],
                "runtime_ms": round(lat_ms, 2),
            })

            disc_dices.append(d_dice)
            cup_dices.append(c_dice)
            if err_exp is not None:
                cdr_errs_expert.append(err_exp)
            if err_mask is not None:
                cdr_errs_mask.append(err_mask)
            rts.append(lat_ms)

        st_dd = aggregate_statistics(np.array(disc_dices))
        st_cd = aggregate_statistics(np.array(cup_dices))
        st_ee = aggregate_statistics(np.array(cdr_errs_expert))
        st_em = aggregate_statistics(np.array(cdr_errs_mask))
        st_rt = aggregate_statistics(np.array(rts))

        summary_records.append({
            "experiment": exp_name,
            "mean_disc_dice": st_dd["mean"],
            "std_disc_dice": st_dd["std"],
            "mean_cup_dice": st_cd["mean"],
            "std_cup_dice": st_cd["std"],
            "median_cup_dice": st_cd["median"],
            "iqr_cup_dice": st_cd["iqr"],
            "mean_cdr_err_expert": st_ee["mean"],
            "median_cdr_err_expert": st_ee["median"],
            "std_cdr_err_expert": st_ee["std"],
            "mean_cdr_err_mask": st_em["mean"],
            "fallback_count": fallback_count,
            "mean_runtime_ms": st_rt["mean"],
        })

        # Save incrementally
        pd.DataFrame(summary_records).to_csv(OUTPUT_DIR / "track_b_experiments_summary.csv", index=False)
        pd.DataFrame(per_image_records).to_csv(OUTPUT_DIR / "track_b_experiments_per_image.csv", index=False)
        print(f"Saved experiment {exp_name}: Mean Cup Dice={st_cd['mean']:.4f}, Mean CDR Err={st_ee['mean']:.4f}")

    df_summary = pd.DataFrame(summary_records)
    df_per_image = pd.DataFrame(per_image_records)

    df_summary.to_csv(OUTPUT_DIR / "track_b_experiments_summary.csv", index=False)
    df_per_image.to_csv(OUTPUT_DIR / "track_b_experiments_per_image.csv", index=False)

    print("Track B controlled experiments completed.")
    print(df_summary[["experiment", "mean_disc_dice", "mean_cup_dice", "mean_cdr_err_expert", "fallback_count"]])
    return df_summary, df_per_image


# ==============================================================================
# STEP 8: CONSTANT-CDR BASELINE & BLAND-ALTMAN AGREEMENT ANALYSIS
# ==============================================================================
def run_constant_cdr_baseline_analysis(adapter: DrishtiGSAdapter, dev_items: list, held_items: list, official_test_items: list):
    """
    1. Calculates constant reference predictor: mean expert CDR from development split only.
    2. Compares segmentation-derived vCDR against:
       - Constant development-mean predictor
       - Reference expert CDR
       - Mask-derived GT CDR
    3. Computes MAE, MedAE, RMSE, Pearson r, Spearman rho, Bland-Altman bias and limits of agreement.
    4. Evaluates separately on development, held-out, and official test sets.
    """
    print("\n--- Running Constant-CDR Baseline & Bland-Altman Agreement Analysis ---")

    # Step 1: Calculate mean expert CDR strictly on development set
    dev_expert_vcdrs = []
    for item in dev_items:
        loaded = adapter.load_item(item)
        ref = loaded.get("ref_vcdr")
        if ref is not None:
            dev_expert_vcdrs.append(ref)

    dev_mean_baseline_cdr = round(float(np.mean(dev_expert_vcdrs)), 4)
    print(f"Constant Development Baseline vCDR = {dev_mean_baseline_cdr} (computed from N={len(dev_expert_vcdrs)} dev images)")

    splits_to_evaluate = [
        ("development", dev_items),
        ("held_out", held_items),
        ("official_test", official_test_items),
    ]

    agreement_summary_rows = []
    per_case_rows = []

    # Selected candidate config
    cand_cfg = {**DEFAULT_DISC_CUP_CONFIG, "cup_channel": "green", "cup_threshold_method": "adaptive_min", "component_selection": "combined_score"}

    for split_name, items in splits_to_evaluate:
        preds_all, refs_all, masks_all = [], [], []
        preds_valid_only, refs_valid_only = [], []

        for item in items:
            loaded = adapter.load_item(item)
            rgb = loaded["rgb_image"]
            d_gt = loaded["disc_gt"]
            c_gt = loaded["cup_gt"]
            ref_expert = loaded.get("ref_vcdr")
            raw_id = item.get("raw_id", item["id"])

            res = segment_optic_disc_and_cup(rgb, gt_disc_mask=d_gt, gt_cup_mask=c_gt, config=cand_cfg, return_intermediate_images=False)
            gt_cdr_info = compute_vertical_cdr(d_gt, c_gt) if (d_gt is not None and c_gt is not None) else {"vcdr": None}
            mask_vcdr = gt_cdr_info.get("vcdr")

            pred_vcdr = res["vertical_cdr"]
            status = res["outcome_status"]
            is_fallback = res["localization_checks"]["disc_fallback_applied"]

            per_case_rows.append({
                "split": split_name,
                "image_id": raw_id,
                "pred_vcdr": pred_vcdr,
                "constant_dev_baseline_vcdr": dev_mean_baseline_cdr,
                "expert_ref_vcdr": ref_expert,
                "mask_gt_vcdr": mask_vcdr,
                "outcome_status": status,
                "is_fallback": is_fallback,
                "disc_dice": res["disc_metrics"]["dice"] if res["disc_metrics"] else None,
                "cup_dice": res["cup_metrics"]["dice"] if res["cup_metrics"] else None,
                "abs_error_pred_vs_expert": calculate_cdr_error(pred_vcdr, ref_expert),
                "abs_error_baseline_vs_expert": calculate_cdr_error(dev_mean_baseline_cdr, ref_expert),
            })

            if pred_vcdr is not None and ref_expert is not None:
                preds_all.append(pred_vcdr)
                refs_all.append(ref_expert)
                if not is_fallback and status != "FAILED":
                    preds_valid_only.append(pred_vcdr)
                    refs_valid_only.append(ref_expert)

        # Compute summary statistics
        p_arr = np.array(preds_all)
        r_arr = np.array(refs_all)
        const_arr = np.full_like(r_arr, dev_mean_baseline_cdr)

        stats_seg = compute_cdr_summary_statistics(p_arr, r_arr)
        stats_base = compute_cdr_summary_statistics(const_arr, r_arr)

        agreement_summary_rows.append({
            "split": split_name,
            "cohort": "All Cases (Pooled)",
            "n_cases": stats_seg["n"],
            "seg_mae": stats_seg["mae"],
            "seg_medae": stats_seg["medae"],
            "seg_rmse": stats_seg["rmse"],
            "seg_pearson_r": stats_seg["pearson_r"],
            "seg_spearman_rho": stats_seg["spearman_rho"],
            "seg_ba_bias": stats_seg["bland_altman"]["bias"] if stats_seg["bland_altman"] else None,
            "seg_ba_loa_lower": stats_seg["bland_altman"]["loa_lower"] if stats_seg["bland_altman"] else None,
            "seg_ba_loa_upper": stats_seg["bland_altman"]["loa_upper"] if stats_seg["bland_altman"] else None,
            "baseline_mae": stats_base["mae"],
            "baseline_medae": stats_base["medae"],
            "baseline_rmse": stats_base["rmse"],
            "baseline_ba_bias": stats_base["bland_altman"]["bias"] if stats_base["bland_altman"] else None,
        })

        if len(preds_valid_only) > 0:
            pv_arr = np.array(preds_valid_only)
            rv_arr = np.array(refs_valid_only)
            const_v_arr = np.full_like(rv_arr, dev_mean_baseline_cdr)
            stats_v_seg = compute_cdr_summary_statistics(pv_arr, rv_arr)
            stats_v_base = compute_cdr_summary_statistics(const_v_arr, rv_arr)

            agreement_summary_rows.append({
                "split": split_name,
                "cohort": "Valid Unfallen Cases Only",
                "n_cases": stats_v_seg["n"],
                "seg_mae": stats_v_seg["mae"],
                "seg_medae": stats_v_seg["medae"],
                "seg_rmse": stats_v_seg["rmse"],
                "seg_pearson_r": stats_v_seg["pearson_r"],
                "seg_spearman_rho": stats_v_seg["spearman_rho"],
                "seg_ba_bias": stats_v_seg["bland_altman"]["bias"] if stats_v_seg["bland_altman"] else None,
                "seg_ba_loa_lower": stats_v_seg["bland_altman"]["loa_lower"] if stats_v_seg["bland_altman"] else None,
                "seg_ba_loa_upper": stats_v_seg["bland_altman"]["loa_upper"] if stats_v_seg["bland_altman"] else None,
                "baseline_mae": stats_v_base["mae"],
                "baseline_medae": stats_v_base["medae"],
                "baseline_rmse": stats_v_base["rmse"],
                "baseline_ba_bias": stats_v_base["bland_altman"]["bias"] if stats_v_base["bland_altman"] else None,
            })

    df_agree = pd.DataFrame(agreement_summary_rows)
    df_per_case = pd.DataFrame(per_case_rows)

    df_agree.to_csv(OUTPUT_DIR / "cdr_baseline_and_bland_altman_agreement.csv", index=False)
    df_per_case.to_csv(OUTPUT_DIR / "cdr_evaluation_per_image.csv", index=False)

    print("Constant-CDR Baseline and Bland-Altman Agreement completed.")
    print(df_agree[["split", "cohort", "n_cases", "seg_mae", "baseline_mae", "seg_pearson_r", "seg_ba_bias"]])
    return df_agree, df_per_case


# ==============================================================================
# STEP 9: RIGOROUS CPU & MEMORY RUNTIME BENCHMARKING
# ==============================================================================
def run_runtime_and_memory_benchmarks(drive_adapter: DriveAdapter, drishti_adapter: DrishtiGSAdapter):
    """
    Measures CPU latency with:
    - 3 warm-up iterations
    - 5 timed repetitions per image using time.perf_counter()
    - Peak memory allocation via tracemalloc
    - Detailed latency percentiles: mean, std, median, IQR, min, max
    """
    print("\n--- Running High-Precision Runtime & Resource Validation ---")
    results = []

    # 1. Track A: Retinal Vessel Segmentation (DRIVE)
    drive_img_item = drive_adapter.get_images("development")[0]
    drive_loaded = drive_adapter.load_item(drive_img_item)
    drive_rgb = drive_loaded["rgb_image"]
    drive_fov = drive_loaded["fov_mask"]

    # Warm-up (3 iterations)
    for _ in range(3):
        segment_retinal_vessels(drive_rgb, fov_mask=drive_fov, return_intermediate_images=False)

    # Timed runs with tracemalloc
    drive_times = []
    drive_peaks = []
    for _ in range(5):
        tracemalloc.start()
        t0 = time.perf_counter()
        segment_retinal_vessels(drive_rgb, fov_mask=drive_fov, return_intermediate_images=False)
        lat = (time.perf_counter() - t0) * 1000.0
        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        drive_times.append(lat)
        drive_peaks.append(peak_mem / (1024 * 1024))  # MB

    st_rt_a = aggregate_statistics(np.array(drive_times))
    results.append({
        "track": "Track A: Retinal Vessel (DRIVE)",
        "resolution": f"{drive_rgb.shape[0]}x{drive_rgb.shape[1]}",
        "n_warmup": 3,
        "n_timed": 5,
        "mean_latency_ms": st_rt_a["mean"],
        "std_latency_ms": st_rt_a["std"],
        "median_latency_ms": st_rt_a["median"],
        "iqr_latency_ms": st_rt_a["iqr"],
        "min_latency_ms": round(float(np.min(drive_times)), 2),
        "max_latency_ms": round(float(np.max(drive_times)), 2),
        "peak_memory_mb": round(float(np.max(drive_peaks)), 2),
    })

    # 2. Track B: Optic Disc and Cup (Drishti-GS)
    drishti_img_item = drishti_adapter.get_images("development")[0]
    drishti_loaded = drishti_adapter.load_item(drishti_img_item)
    drishti_rgb = drishti_loaded["rgb_image"]

    for _ in range(3):
        segment_optic_disc_and_cup(drishti_rgb, return_intermediate_images=False)

    drishti_times = []
    drishti_peaks = []
    for _ in range(5):
        tracemalloc.start()
        t0 = time.perf_counter()
        segment_optic_disc_and_cup(drishti_rgb, return_intermediate_images=False)
        lat = (time.perf_counter() - t0) * 1000.0
        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        drishti_times.append(lat)
        drishti_peaks.append(peak_mem / (1024 * 1024))

    st_rt_b = aggregate_statistics(np.array(drishti_times))
    results.append({
        "track": "Track B: Optic Disc & Cup (Drishti-GS)",
        "resolution": f"{drishti_rgb.shape[0]}x{drishti_rgb.shape[1]}",
        "n_warmup": 3,
        "n_timed": 5,
        "mean_latency_ms": st_rt_b["mean"],
        "std_latency_ms": st_rt_b["std"],
        "median_latency_ms": st_rt_b["median"],
        "iqr_latency_ms": st_rt_b["iqr"],
        "min_latency_ms": round(float(np.min(drishti_times)), 2),
        "max_latency_ms": round(float(np.max(drishti_times)), 2),
        "peak_memory_mb": round(float(np.max(drishti_peaks)), 2),
    })

    df_runtime = pd.DataFrame(results)
    df_runtime.to_csv(OUTPUT_DIR / "rigorous_runtime_benchmark.csv", index=False)
    print("Runtime and memory benchmarking completed.")
    print(df_runtime)
    return df_runtime


# ==============================================================================
# MAIN EXECUTION ORCHESTRATION
# ==============================================================================
def main():
    print("=" * 80)
    print("STARTING SCIENTIFIC RESEARCH-READINESS VALIDATION SUITE")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("Hardware Environment:", json.dumps(get_hardware_info(), indent=2))
    print("=" * 80)

    drive_adapter = DriveAdapter()
    drishti_adapter = DrishtiGSAdapter()

    drive_dev = drive_adapter.get_images("development")
    drive_held = drive_adapter.get_images("held_out")

    drishti_dev = drishti_adapter.get_images("development")
    drishti_held = drishti_adapter.get_images("held_out")
    drishti_official_test = drishti_adapter.get_images("test")

    print(f"DRIVE Development: {len(drive_dev)} images, Held-out: {len(drive_held)} images")
    print(f"Drishti-GS Development: {len(drishti_dev)} images, Held-out: {len(drishti_held)} images, Official Test: {len(drishti_official_test)} images")

    # 1. Track A Sigma Sweep
    if not (OUTPUT_DIR / "track_a_sigma_sweep_summary.csv").exists():
        run_track_a_sigma_sweep(drive_adapter, drive_dev)
    else:
        print("Track A Sigma Sweep already completed. Skipping.")

    # 2. Track A Ablation Study
    if not (OUTPUT_DIR / "track_a_ablation_summary.csv").exists():
        run_track_a_ablation_study(drive_adapter, drive_dev)
    else:
        print("Track A Ablation Study already completed. Skipping.")

    # 3. Track B Failure Diagnostics
    if not (OUTPUT_DIR / "track_b_failure_diagnostics_verified.csv").exists():
        run_track_b_failure_diagnostics(drishti_adapter)
    else:
        print("Track B Failure Diagnostics already completed. Skipping.")

    # 4. Track B Controlled Experiments
    run_track_b_controlled_experiments(drishti_adapter, drishti_dev)

    # 5. Constant CDR Baseline & Bland-Altman Agreement
    run_constant_cdr_baseline_analysis(drishti_adapter, drishti_dev, drishti_held, drishti_official_test)

    # 6. Rigorous Runtime Benchmarks
    run_runtime_and_memory_benchmarks(drive_adapter, drishti_adapter)

    print("\n" + "=" * 80)
    print("ALL SCIENTIFIC VALIDATION PHASES EXECUTED SUCCESSFULLY.")
    print(f"Artifacts saved in: {OUTPUT_DIR.resolve()}")
    print("=" * 80)

if __name__ == "__main__":
    main()
