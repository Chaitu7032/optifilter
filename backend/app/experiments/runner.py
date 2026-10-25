"""
OptiFilter / MorphoVision - Benchmark & Ablation Experiment Runner
Automates reproducible benchmark evaluation, one-variable-at-a-time ablations,
and CPU performance quantification across datasets.
"""
from typing import Dict, Any, List, Optional
import time
from datetime import datetime
import uuid
import numpy as np
import pandas as pd

from app.evaluation.dataset_adapters import get_all_adapters
from app.dip.vessel_segmentation import segment_retinal_vessels
from app.dip.disc_cup_segmentation import segment_optic_disc_and_cup
from app.evaluation.metrics import calculate_segmentation_metrics, compute_vertical_cdr, calculate_cdr_error
from app.db.database import save_benchmark_run, save_experiment_run
from app.config import DEFAULT_VESSEL_CONFIG, DEFAULT_DISC_CUP_CONFIG, ARTIFACTS_DIR


def execute_benchmark_run(
    dataset_name: str,
    split: str,
    track: str,  # "vessels" or "disc_cup"
    custom_params: Optional[Dict[str, Any]] = None,
    run_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes a formal quantitative benchmark across all images in a dataset split.
    Calculates per-image metrics against ground-truth and aggregate statistics.
    """
    adapters = get_all_adapters()
    adapter = adapters.get(dataset_name)
    if not adapter or not adapter.is_installed():
        raise ValueError(f"Dataset '{dataset_name}' is not installed or available.")

    images = adapter.get_images(split=split)
    if not images:
        raise ValueError(f"No images found for dataset '{dataset_name}' in split '{split}'.")

    run_id = f"bench_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    name = run_name or f"{dataset_name} {split.upper()} {track.capitalize()}"
    per_image_results: List[Dict[str, Any]] = []

    dice_scores = []
    iou_scores = []
    sens_scores = []
    spec_scores = []
    prec_scores = []
    cdr_errors = []
    runtimes = []

    for item in images:
        loaded = adapter.load_item(item)
        rgb_img = loaded["rgb_image"]
        fov = loaded.get("fov_mask")

        if track == "vessels":
            vessel_gt = loaded.get("vessel_gt")
            # Run Track A pipeline
            res = segment_retinal_vessels(
                rgb_img,
                fov_mask=fov,
                config=custom_params,
                return_intermediate_images=False,
            )

            metrics = None
            if vessel_gt is not None:
                metrics = calculate_segmentation_metrics(
                    res["binary_mask"],
                    vessel_gt,
                    mask=fov if fov is not None else (np.ones(rgb_img.shape[:2], dtype=bool)),
                )
                dice_scores.append(metrics["dice"])
                iou_scores.append(metrics["iou"])
                sens_scores.append(metrics["sensitivity"])
                spec_scores.append(metrics["specificity"])
                prec_scores.append(metrics["precision"])

            elapsed_ms = res["telemetry"]["total_ms"]
            runtimes.append(elapsed_ms)

            per_image_results.append({
                "item_id": item["id"],
                "runtime_ms": elapsed_ms,
                "vessel_density": res["vessel_density"],
                "metrics": metrics,
            })

        else:  # track == "disc_cup"
            disc_gt = loaded.get("disc_gt")
            cup_gt = loaded.get("cup_gt")

            res = segment_optic_disc_and_cup(
                rgb_img,
                fov_mask=fov,
                gt_disc_mask=disc_gt,
                gt_cup_mask=cup_gt,
                config=custom_params,
                return_intermediate_images=False,
            )

            elapsed_ms = res["telemetry"]["total_ms"]
            runtimes.append(elapsed_ms)

            if res["disc_metrics"]:
                dice_scores.append(res["disc_metrics"]["dice"])
                iou_scores.append(res["disc_metrics"]["iou"])
                sens_scores.append(res["disc_metrics"]["sensitivity"])
                spec_scores.append(res["disc_metrics"]["specificity"])
                prec_scores.append(res["disc_metrics"]["precision"])

            if res["cdr_absolute_error"] is not None:
                cdr_errors.append(res["cdr_absolute_error"])

            per_image_results.append({
                "item_id": item["id"],
                "runtime_ms": elapsed_ms,
                "vcdr": res["vertical_cdr"],
                "disc_metrics": res["disc_metrics"],
                "cup_metrics": res["cup_metrics"],
                "cdr_absolute_error": res["cdr_absolute_error"],
                "warnings": res["warnings"],
            })

    # Aggregates
    mean_dice = float(np.mean(dice_scores)) if dice_scores else None
    mean_iou = float(np.mean(iou_scores)) if iou_scores else None
    mean_sens = float(np.mean(sens_scores)) if sens_scores else None
    mean_spec = float(np.mean(spec_scores)) if spec_scores else None
    mean_prec = float(np.mean(prec_scores)) if prec_scores else None
    mean_cdr_err = float(np.mean(cdr_errors)) if cdr_errors else None
    mean_lat = float(np.mean(runtimes)) if runtimes else 0.0
    median_lat = float(np.median(runtimes)) if runtimes else 0.0

    run_record = {
        "id": run_id,
        "name": name,
        "dataset": dataset_name,
        "split": split,
        "track": track,
        "status": "completed",
        "created_at": datetime.now().isoformat(),
        "num_images": len(images),
        "mean_dice": round(mean_dice, 4) if mean_dice is not None else None,
        "mean_iou": round(mean_iou, 4) if mean_iou is not None else None,
        "mean_sensitivity": round(mean_sens, 4) if mean_sens is not None else None,
        "mean_specificity": round(mean_spec, 4) if mean_spec is not None else None,
        "mean_precision": round(mean_prec, 4) if mean_prec is not None else None,
        "mean_cdr_error": round(mean_cdr_err, 4) if mean_cdr_err is not None else None,
        "mean_runtime_ms": round(mean_lat, 2),
        "median_runtime_ms": round(median_lat, 2),
        "parameters": custom_params or (DEFAULT_VESSEL_CONFIG if track == "vessels" else DEFAULT_DISC_CUP_CONFIG),
        "per_image_results": per_image_results,
        "telemetry": {
            "num_evaluated": len(images),
            "under_two_seconds": mean_lat < 2000.0,
            "images_per_second": round(1000.0 / mean_lat, 2) if mean_lat > 0 else 0.0,
        },
    }

    # Persist in SQLite
    save_benchmark_run(run_record)

    # Save artifact CSV
    csv_rows = []
    for r in per_image_results:
        row = {"item_id": r["item_id"], "runtime_ms": r["runtime_ms"]}
        if track == "vessels" and r.get("metrics"):
            row.update(r["metrics"])
            row["vessel_density"] = r.get("vessel_density")
        elif track == "disc_cup":
            row["vcdr"] = r.get("vcdr")
            row["cdr_error"] = r.get("cdr_absolute_error")
            if r.get("disc_metrics"):
                row["disc_dice"] = r["disc_metrics"]["dice"]
                row["disc_iou"] = r["disc_metrics"]["iou"]
        csv_rows.append(row)

    if csv_rows:
        df = pd.DataFrame(csv_rows)
        csv_path = ARTIFACTS_DIR / f"{run_id}.csv"
        df.to_csv(csv_path, index=False)

    return run_record


def run_standard_ablation_matrix(dataset_name: str = "DRIVE", split: str = "training") -> List[Dict[str, Any]]:
    """
    Executes one-variable-at-a-time ablation experiments as mandated in Section 8:
    - Track A Vessel Ablations:
      1. Default (CLAHE + Multiscale Frangi + Hysteresis)
      2. No CLAHE (Green channel only)
      3. Single-Scale Frangi (sigma=2.0)
      4. Global Otsu Thresholding vs Hysteresis
    - Track B Disc/Cup Ablations:
      1. Default (Red channel + Closing + Smooth sigma=0.02)
      2. Green channel for localization
      3. Without morphological closing
      4. Large Gaussian smoothing (sigma=0.04)
    """
    results = []

    # 1. Track A: Vessel Baseline
    res_v_base = execute_benchmark_run(
        dataset_name=dataset_name,
        split=split,
        track="vessels",
        custom_params=DEFAULT_VESSEL_CONFIG,
        run_name="Track A: Baseline (CLAHE + Multiscale + Hysteresis)",
    )
    save_experiment_run({
        "id": f"exp_v_base_{uuid.uuid4().hex[:6]}",
        "name": "Track A Baseline",
        "track": "vessels",
        "variant_name": "Full Baseline (CLAHE + Multiscale [1-4] + Hysteresis)",
        "description": "Standard multiscale Frangi with CLAHE enhancement and percentile hysteresis.",
        "dataset": dataset_name,
        "status": "completed",
        "created_at": datetime.now().isoformat(),
        "parameters": DEFAULT_VESSEL_CONFIG,
        "summary_metrics": {
            "mean_dice": res_v_base["mean_dice"],
            "mean_iou": res_v_base["mean_iou"],
            "mean_sensitivity": res_v_base["mean_sensitivity"],
            "mean_specificity": res_v_base["mean_specificity"],
        },
        "runtime_ms": res_v_base["mean_runtime_ms"],
    })
    results.append(res_v_base)

    # 2. Track A: Ablation - No CLAHE
    no_clahe_cfg = {**DEFAULT_VESSEL_CONFIG, "use_clahe": False}
    res_v_no_clahe = execute_benchmark_run(
        dataset_name=dataset_name,
        split=split,
        track="vessels",
        custom_params=no_clahe_cfg,
        run_name="Track A: Ablation (Raw Green, No CLAHE)",
    )
    save_experiment_run({
        "id": f"exp_v_noclahe_{uuid.uuid4().hex[:6]}",
        "name": "Track A No-CLAHE",
        "track": "vessels",
        "variant_name": "No CLAHE (Raw Green Channel)",
        "description": "Ablates local histogram equalization to evaluate impact on thin peripheral vessel recall.",
        "dataset": dataset_name,
        "status": "completed",
        "created_at": datetime.now().isoformat(),
        "parameters": no_clahe_cfg,
        "summary_metrics": {
            "mean_dice": res_v_no_clahe["mean_dice"],
            "mean_iou": res_v_no_clahe["mean_iou"],
            "mean_sensitivity": res_v_no_clahe["mean_sensitivity"],
            "mean_specificity": res_v_no_clahe["mean_specificity"],
        },
        "runtime_ms": res_v_no_clahe["mean_runtime_ms"],
    })
    results.append(res_v_no_clahe)

    # 3. Track A: Ablation - Single-Scale Frangi
    single_scale_cfg = {**DEFAULT_VESSEL_CONFIG, "frangi_sigmas": [2.0]}
    res_v_single = execute_benchmark_run(
        dataset_name=dataset_name,
        split=split,
        track="vessels",
        custom_params=single_scale_cfg,
        run_name="Track A: Ablation (Single-Scale sigma=2.0)",
    )
    save_experiment_run({
        "id": f"exp_v_single_{uuid.uuid4().hex[:6]}",
        "name": "Track A Single-Scale",
        "track": "vessels",
        "variant_name": "Single-Scale Frangi (sigma=2.0)",
        "description": "Evaluates speed-accuracy trade-off by disabling multiscale Hessian decomposition.",
        "dataset": dataset_name,
        "status": "completed",
        "created_at": datetime.now().isoformat(),
        "parameters": single_scale_cfg,
        "summary_metrics": {
            "mean_dice": res_v_single["mean_dice"],
            "mean_iou": res_v_single["mean_iou"],
            "mean_sensitivity": res_v_single["mean_sensitivity"],
            "mean_specificity": res_v_single["mean_specificity"],
        },
        "runtime_ms": res_v_single["mean_runtime_ms"],
    })
    results.append(res_v_single)

    # 4. Track A: Ablation - Global Otsu Thresholding
    otsu_cfg = {**DEFAULT_VESSEL_CONFIG, "threshold_method": "global_otsu"}
    res_v_otsu = execute_benchmark_run(
        dataset_name=dataset_name,
        split=split,
        track="vessels",
        custom_params=otsu_cfg,
        run_name="Track A: Ablation (Global Otsu Thresholding)",
    )
    save_experiment_run({
        "id": f"exp_v_otsu_{uuid.uuid4().hex[:6]}",
        "name": "Track A Global Otsu",
        "track": "vessels",
        "variant_name": "Global Otsu Baseline",
        "description": "Replaces dual-threshold hysteresis with standard Otsu global binarization.",
        "dataset": dataset_name,
        "status": "completed",
        "created_at": datetime.now().isoformat(),
        "parameters": otsu_cfg,
        "summary_metrics": {
            "mean_dice": res_v_otsu["mean_dice"],
            "mean_iou": res_v_otsu["mean_iou"],
            "mean_sensitivity": res_v_otsu["mean_sensitivity"],
            "mean_specificity": res_v_otsu["mean_specificity"],
        },
        "runtime_ms": res_v_otsu["mean_runtime_ms"],
    })
    results.append(res_v_otsu)

    # 5. Track B: Disc/Cup Baseline
    res_dc_base = execute_benchmark_run(
        dataset_name=dataset_name,
        split=split,
        track="disc_cup",
        custom_params=DEFAULT_DISC_CUP_CONFIG,
        run_name="Track B: Baseline (Red Channel + Closing + Snake)",
    )
    save_experiment_run({
        "id": f"exp_dc_base_{uuid.uuid4().hex[:6]}",
        "name": "Track B Baseline",
        "track": "disc_cup",
        "variant_name": "Full Baseline (Red Channel + Closing + Active Contour)",
        "description": "Standard red channel luminance, adaptive morphological closing, and bounded active contour.",
        "dataset": dataset_name,
        "status": "completed",
        "created_at": datetime.now().isoformat(),
        "parameters": DEFAULT_DISC_CUP_CONFIG,
        "summary_metrics": {
            "mean_dice": res_dc_base["mean_dice"],
            "mean_iou": res_dc_base["mean_iou"],
            "mean_cdr_error": res_dc_base["mean_cdr_error"],
        },
        "runtime_ms": res_dc_base["mean_runtime_ms"],
    })
    results.append(res_dc_base)

    # 6. Track B: Ablation - Green Channel for Localization
    green_dc_cfg = {**DEFAULT_DISC_CUP_CONFIG, "disc_channel": "green"}
    res_dc_green = execute_benchmark_run(
        dataset_name=dataset_name,
        split=split,
        track="disc_cup",
        custom_params=green_dc_cfg,
        run_name="Track B: Ablation (Green Channel for Localization)",
    )
    save_experiment_run({
        "id": f"exp_dc_green_{uuid.uuid4().hex[:6]}",
        "name": "Track B Green Channel",
        "track": "disc_cup",
        "variant_name": "Green Channel Localization",
        "description": "Uses green channel instead of red channel for optic disc luminance centroid detection.",
        "dataset": dataset_name,
        "status": "completed",
        "created_at": datetime.now().isoformat(),
        "parameters": green_dc_cfg,
        "summary_metrics": {
            "mean_dice": res_dc_green["mean_dice"],
            "mean_iou": res_dc_green["mean_iou"],
            "mean_cdr_error": res_dc_green["mean_cdr_error"],
        },
        "runtime_ms": res_dc_green["mean_runtime_ms"],
    })
    results.append(res_dc_green)

    return results
