"""
Audit script for DRIVE and Drishti-GS datasets in OptiFilter.
Checks:
- File paths and existence
- Image dimensions
- Annotation presence and dimensions
- Split assignments
- Image-to-annotation correspondence
"""
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
import pandas as pd

from app.config import DATASETS_DIR, MANIFESTS_DIR

def audit_drive():
    drive_dir = DATASETS_DIR / "DRIVE"
    splits_path = MANIFESTS_DIR / "fixed_splits.json"
    with open(splits_path, "r") as f:
        manifest = json.load(f)
    drive_manifest = manifest.get("DRIVE", {})
    dev_set = set(drive_manifest.get("development", []))
    held_set = set(drive_manifest.get("held_out", []))

    records = []

    # Training
    train_img_dir = drive_dir / "training" / "images"
    train_gt_dir = drive_dir / "training" / "1st_manual"
    train_mask_dir = drive_dir / "training" / "mask"

    if train_img_dir.exists():
        for p in sorted(train_img_dir.glob("*.tif")):
            raw_id = p.stem  # e.g. 21_training
            stem = raw_id.replace("_training", "")
            gt_p = train_gt_dir / f"{stem}_manual1.gif"
            mask_p = train_mask_dir / f"{stem}_training_mask.gif"

            img = cv2.imread(str(p))
            h, w = img.shape[:2] if img is not None else (None, None)

            gt_h, gt_w = None, None
            if gt_p.exists():
                gt_img = Image.open(gt_p)
                gt_w, gt_h = gt_img.size

            mask_h, mask_w = None, None
            if mask_p.exists():
                mask_img = Image.open(mask_p)
                mask_w, mask_h = mask_img.size

            split = "development" if raw_id in dev_set else ("held_out" if raw_id in held_set else "training_unassigned")

            records.append({
                "dataset": "DRIVE",
                "canonical_id": f"drive_training_{stem}",
                "raw_id": raw_id,
                "split": split,
                "dataset_subfolder": "training",
                "image_path": str(p.relative_to(DATASETS_DIR)),
                "image_exists": p.exists(),
                "image_shape": f"{h}x{w}" if h else "CORRUPT",
                "annotation_path": str(gt_p.relative_to(DATASETS_DIR)) if gt_p.exists() else "MISSING",
                "annotation_exists": gt_p.exists(),
                "annotation_shape": f"{gt_h}x{gt_w}" if gt_h else "NONE",
                "fov_mask_path": str(mask_p.relative_to(DATASETS_DIR)) if mask_p.exists() else "MISSING",
                "fov_mask_exists": mask_p.exists(),
                "fov_shape": f"{mask_h}x{mask_w}" if mask_h else "NONE",
                "dimension_match": (h == gt_h == mask_h and w == gt_w == mask_w) if (h and gt_h and mask_h) else False,
            })

    # Test
    test_img_dir = drive_dir / "test" / "images"
    test_mask_dir = drive_dir / "test" / "mask"
    test_gt_dir = drive_dir / "test" / "1st_manual"

    if test_img_dir.exists():
        for p in sorted(test_img_dir.glob("*.tif")):
            raw_id = p.stem  # e.g. 01_test
            stem = raw_id.replace("_test", "")
            gt_p = test_gt_dir / f"{stem}_manual1.gif"
            mask_p = test_mask_dir / f"{stem}_test_mask.gif"

            img = cv2.imread(str(p))
            h, w = img.shape[:2] if img is not None else (None, None)

            gt_h, gt_w = None, None
            if gt_p.exists():
                gt_img = Image.open(gt_p)
                gt_w, gt_h = gt_img.size

            mask_h, mask_w = None, None
            if mask_p.exists():
                mask_img = Image.open(mask_p)
                mask_w, mask_h = mask_img.size

            records.append({
                "dataset": "DRIVE",
                "canonical_id": f"drive_test_{stem}",
                "raw_id": raw_id,
                "split": "test",
                "dataset_subfolder": "test",
                "image_path": str(p.relative_to(DATASETS_DIR)),
                "image_exists": p.exists(),
                "image_shape": f"{h}x{w}" if h else "CORRUPT",
                "annotation_path": str(gt_p.relative_to(DATASETS_DIR)) if gt_p.exists() else "MISSING",
                "annotation_exists": gt_p.exists(),
                "annotation_shape": f"{gt_h}x{gt_w}" if gt_h else "NONE",
                "fov_mask_path": str(mask_p.relative_to(DATASETS_DIR)) if mask_p.exists() else "MISSING",
                "fov_mask_exists": mask_p.exists(),
                "fov_shape": f"{mask_h}x{mask_w}" if mask_h else "NONE",
                "dimension_match": (h == mask_h and w == mask_w) if (h and mask_h) else False,
            })

    return pd.DataFrame(records)

def audit_drishti():
    drishti_dir = DATASETS_DIR / "Dristhi GS"
    splits_path = MANIFESTS_DIR / "fixed_splits.json"
    with open(splits_path, "r") as f:
        manifest = json.load(f)
    drishti_manifest = manifest.get("Drishti-GS", {})
    dev_set = set(drishti_manifest.get("development", []))
    held_set = set(drishti_manifest.get("held_out", []))

    records = []
    # Find all fundus image files
    all_pngs = sorted(drishti_dir.rglob("*.png"))
    fundus_pngs = [
        p for p in all_pngs
        if "GT" not in p.parts and "Test_GT" not in p.parts and "SoftMap" not in p.parts and "AvgBoundary" not in p.parts
    ]

    for p in fundus_pngs:
        raw_id = p.stem  # e.g. drishtiGS_001
        is_official_test = "test" in str(p).lower()
        subfolder = "test" if is_official_test else "training"

        # Lookup split in manifest
        if raw_id in dev_set:
            split = "development"
        elif raw_id in held_set:
            split = "held_out"
        elif is_official_test:
            split = "official_test"
        else:
            split = "unassigned"

        img = cv2.imread(str(p))
        h, w = img.shape[:2] if img is not None else (None, None)

        # Locate GT directory
        gt_dirs = [d for d in drishti_dir.rglob(raw_id) if d.is_dir() and ("GT" in d.parts or "Test_GT" in d.parts)]
        gt_dir = gt_dirs[0] if gt_dirs else None

        disc_gt_p, cup_gt_p, cdr_p = None, None, None
        disc_h, disc_w, cup_h, cup_w = None, None, None, None
        cdr_val = None

        if gt_dir:
            soft_od = list(gt_dir.glob("**/*OD*soft*")) or list(gt_dir.glob("**/*OD*Soft*")) or list(gt_dir.glob("**/*OD*"))
            soft_cup = list(gt_dir.glob("**/*cup*soft*")) or list(gt_dir.glob("**/*cup*Soft*")) or list(gt_dir.glob("**/*cup*"))
            cdr_files = list(gt_dir.glob("**/*cdr*"))

            if soft_od:
                disc_gt_p = soft_od[0]
                d_img = cv2.imread(str(disc_gt_p), cv2.IMREAD_GRAYSCALE)
                if d_img is not None:
                    disc_h, disc_w = d_img.shape[:2]

            if soft_cup:
                cup_gt_p = soft_cup[0]
                c_img = cv2.imread(str(cup_gt_p), cv2.IMREAD_GRAYSCALE)
                if c_img is not None:
                    cup_h, cup_w = c_img.shape[:2]

            if cdr_files:
                cdr_p = cdr_files[0]
                try:
                    with open(cdr_p, "r") as cf:
                        vals = [float(x) for x in cf.read().split() if x.strip()]
                        if vals:
                            cdr_val = round(float(np.mean(vals)), 4)
                except Exception:
                    pass

        dim_match = (h == disc_h == cup_h and w == disc_w == cup_w) if (h and disc_h and cup_h) else False

        records.append({
            "dataset": "Drishti-GS",
            "canonical_id": f"drishti_{subfolder}_{raw_id}",
            "raw_id": raw_id,
            "split": split,
            "dataset_subfolder": subfolder,
            "image_path": str(p.relative_to(DATASETS_DIR)),
            "image_exists": p.exists(),
            "image_shape": f"{h}x{w}" if h else "CORRUPT",
            "disc_gt_path": str(disc_gt_p.relative_to(DATASETS_DIR)) if disc_gt_p else "MISSING",
            "disc_gt_exists": disc_gt_p is not None,
            "disc_gt_shape": f"{disc_h}x{disc_w}" if disc_h else "NONE",
            "cup_gt_path": str(cup_gt_p.relative_to(DATASETS_DIR)) if cup_gt_p else "MISSING",
            "cup_gt_exists": cup_gt_p is not None,
            "cup_gt_shape": f"{cup_h}x{cup_w}" if cup_h else "NONE",
            "cdr_txt_exists": cdr_p is not None,
            "expert_mean_vcdr": cdr_val,
            "dimension_match": dim_match,
        })

    return pd.DataFrame(records)

if __name__ == "__main__":
    df_drive = audit_drive()
    df_drishti = audit_drishti()
    
    out_dir = Path("research_outputs")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    df_drive.to_csv(out_dir / "audit_drive_inventory.csv", index=False)
    df_drishti.to_csv(out_dir / "audit_drishti_inventory.csv", index=False)
    
    print("=== DRIVE AUDIT SUMMARY ===")
    print(f"Total DRIVE records: {len(df_drive)}")
    print(df_drive.groupby(["dataset_subfolder", "split", "annotation_exists", "fov_mask_exists"]).size())
    print("\n=== DRISHTI-GS AUDIT SUMMARY ===")
    print(f"Total Drishti-GS records: {len(df_drishti)}")
    print(df_drishti.groupby(["dataset_subfolder", "split", "disc_gt_exists", "cup_gt_exists", "cdr_txt_exists"]).size())
    print("\nAudit completed and CSVs saved.")
