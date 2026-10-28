"""
Generates comprehensive split manifest and updates fixed_splits.json with all invariants.
"""
import json
from pathlib import Path
import pandas as pd
from app.config import MANIFESTS_DIR, DATASETS_DIR

def build_manifests():
    df_drive = pd.read_csv("research_outputs/audit_drive_inventory.csv")
    df_drishti = pd.read_csv("research_outputs/audit_drishti_inventory.csv")

    drive_records = []
    for _, row in df_drive.iterrows():
        inclusion = "Labeled training sample for classical DIP development." if row["split"] == "development" else (
            "Labeled held-out validation sample for internal protocol." if row["split"] == "held_out" else
            "Official DRIVE test sample (vessel ground-truth manual annotations absent in local distribution; FOV mask present)."
        )
        drive_records.append({
            "canonical_id": row["canonical_id"],
            "raw_id": row["raw_id"],
            "dataset": "DRIVE",
            "split": row["split"],
            "image_path": row["image_path"],
            "annotation_path": row["annotation_path"] if row["annotation_exists"] else None,
            "fov_mask_path": row["fov_mask_path"] if row["fov_mask_exists"] else None,
            "has_reference_annotation": bool(row["annotation_exists"]),
            "inclusion_or_exclusion_reason": inclusion,
        })

    drishti_records = []
    for _, row in df_drishti.iterrows():
        inclusion = "Labeled training sample for classical DIP development." if row["split"] == "development" else (
            "Labeled held-out training sample for internal validation." if row["split"] == "held_out" else
            "Official Drishti-GS test sample (51 images in Test_GT with expert SoftMap and CDR ratings)."
        )
        drishti_records.append({
            "canonical_id": row["canonical_id"],
            "raw_id": row["raw_id"],
            "dataset": "Drishti-GS",
            "split": row["split"],
            "image_path": row["image_path"],
            "disc_gt_path": row["disc_gt_path"] if row["disc_gt_exists"] else None,
            "cup_gt_path": row["cup_gt_path"] if row["cup_gt_exists"] else None,
            "cdr_txt_path": row.get("cdr_txt_path"),
            "has_reference_annotation": bool(row["disc_gt_exists"] and row["cup_gt_exists"]),
            "expert_mean_vcdr": float(row["expert_mean_vcdr"]) if pd.notnull(row["expert_mean_vcdr"]) else None,
            "inclusion_or_exclusion_reason": inclusion,
        })

    manifest = {
        "metadata": {
            "protocol": "OptiFilter / MorphoVision Classical DIP Research Protocol v2.0",
            "audit_date": "2026-10-26",
            "total_drive_images": len(drive_records),
            "total_drishti_images": len(drishti_records),
            "drive_labeled_count": sum(1 for r in drive_records if r["has_reference_annotation"]),
            "drive_unlabeled_test_count": sum(1 for r in drive_records if not r["has_reference_annotation"]),
            "drishti_dev_count": sum(1 for r in drishti_records if r["split"] == "development"),
            "drishti_held_out_count": sum(1 for r in drishti_records if r["split"] == "held_out"),
            "drishti_official_test_count": sum(1 for r in drishti_records if r["split"] == "official_test"),
        },
        "DRIVE": drive_records,
        "Drishti-GS": drishti_records,
    }

    MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(MANIFESTS_DIR / "comprehensive_split_manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)

    # Also update fixed_splits.json with official_test listed
    drive_dev = [r["raw_id"] for r in drive_records if r["split"] == "development"]
    drive_held = [r["raw_id"] for r in drive_records if r["split"] == "held_out"]
    drive_test = [r["raw_id"] for r in drive_records if r["split"] == "test"]

    drishti_dev = [r["raw_id"] for r in drishti_records if r["split"] == "development"]
    drishti_held = [r["raw_id"] for r in drishti_records if r["split"] == "held_out"]
    drishti_test = [r["raw_id"] for r in drishti_records if r["split"] == "official_test"]

    fixed_splits = {
        "manifest_metadata": {
            "protocol": "OptiFilter Internal Empirical Validation Protocol — v2 (Research-Ready)",
            "seed": 42,
            "created_at": "2026-10-26T16:00:00",
            "drishti_gs_note": "50 official training images split into 35 dev and 15 held-out by seed 42. 51 official test images preserved in official_test.",
            "drive_note": "20 training images split into 15 dev and 5 held-out by seed 42. 20 official test images (unlabeled vessel GT) recorded in official_test."
        },
        "DRIVE": {
            "development": drive_dev,
            "held_out": drive_held,
            "official_test": drive_test,
        },
        "Drishti-GS": {
            "development": drishti_dev,
            "held_out": drishti_held,
            "official_test": drishti_test,
        },
        "BundledDemo": {
            "development": ["sample_01_dev", "sample_02_dev", "sample_03_dev"],
            "held_out": ["sample_04_held_out"]
        }
    }

    with open(MANIFESTS_DIR / "fixed_splits.json", "w") as f:
        json.dump(fixed_splits, f, indent=2)

    print("Manifests generated successfully.")
    print(f"DRIVE dev: {len(drive_dev)}, held: {len(drive_held)}, test: {len(drive_test)}")
    print(f"Drishti dev: {len(drishti_dev)}, held: {len(drishti_held)}, official_test: {len(drishti_test)}")

if __name__ == "__main__":
    build_manifests()
