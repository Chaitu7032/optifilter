"""
OptiFilter / MorphoVision - Pilot Vessel Segmentation Benchmark
Evaluates the classical DIP vessel segmentation pipeline on the first 5 annotated DRIVE images.
Measures FOV-restricted Dice, IoU, Sensitivity, Specificity, and CPU runtime.
"""
import time
import numpy as np
import pandas as pd
from app.evaluation.dataset_adapters import DriveAdapter
from app.dip.vessel_segmentation import segment_retinal_vessels
from app.evaluation.metrics import calculate_segmentation_metrics


def run_pilot():
    adapter = DriveAdapter()
    if not adapter.is_installed():
        print("ERROR: DRIVE dataset is not installed in backend/data/datasets/DRIVE")
        return

    images = adapter.get_images(split="training")[:5]
    print(f"Loaded {len(images)} pilot DRIVE images for evaluation.\n")

    results = []
    print(f"{'Image ID':<20} | {'Dice':<8} | {'IoU':<8} | {'Sens':<8} | {'Spec':<8} | {'Density':<8} | {'Runtime (ms)':<12}")
    print("-" * 85)

    for item in images:
        loaded = adapter.load_item(item)
        rgb = loaded["rgb_image"]
        fov = loaded["fov_mask"]
        gt = loaded["vessel_gt"]

        res = segment_retinal_vessels(rgb, fov_mask=fov, return_intermediate_images=False)
        pred_mask = res["binary_mask"]

        metrics = calculate_segmentation_metrics(pred_mask, gt, mask=fov)
        row = {
            "item_id": item["id"],
            "dice": metrics["dice"],
            "iou": metrics["iou"],
            "sensitivity": metrics["sensitivity"],
            "specificity": metrics["specificity"],
            "precision": metrics["precision"],
            "vessel_density": res["vessel_density"],
            "runtime_ms": res["telemetry"]["total_ms"],
        }
        results.append(row)
        print(f"{row['item_id']:<20} | {row['dice']:<8.4f} | {row['iou']:<8.4f} | {row['sensitivity']:<8.4f} | {row['specificity']:<8.4f} | {row['vessel_density']:<8.4f} | {row['runtime_ms']:<12.1f}")

    df = pd.DataFrame(results)
    print("-" * 85)
    print(f"{'MEAN (5 Images)':<20} | {df['dice'].mean():<8.4f} | {df['iou'].mean():<8.4f} | {df['sensitivity'].mean():<8.4f} | {df['specificity'].mean():<8.4f} | {df['vessel_density'].mean():<8.4f} | {df['runtime_ms'].mean():<12.1f}")
    print(f"{'STD DEV':<20} | {df['dice'].std():<8.4f} | {df['iou'].std():<8.4f} | {df['sensitivity'].std():<8.4f} | {df['specificity'].std():<8.4f} | {df['vessel_density'].std():<8.4f} | {df['runtime_ms'].std():<12.1f}")


if __name__ == "__main__":
    run_pilot()
