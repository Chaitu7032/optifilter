"""
Tests for Split Manifest Invariants (Section 3.3 of Research Directive).
Verifies:
- Canonical ID uniqueness
- No duplicate split membership
- Non-empty source image paths and disk existence
- Disjoint splits
- Annotation availability where required
"""
import json
from pathlib import Path
import pytest
from app.config import MANIFESTS_DIR, DATASETS_DIR

@pytest.fixture(scope="module")
def manifests():
    fixed_p = MANIFESTS_DIR / "fixed_splits.json"
    comp_p = MANIFESTS_DIR / "comprehensive_split_manifest.json"
    assert fixed_p.exists(), "fixed_splits.json must exist"
    assert comp_p.exists(), "comprehensive_split_manifest.json must exist"
    with open(fixed_p, "r") as f:
        fixed = json.load(f)
    with open(comp_p, "r") as f:
        comp = json.load(f)
    return {"fixed": fixed, "comp": comp}

def test_drive_splits_disjoint_and_complete(manifests):
    drive_fixed = manifests["fixed"]["DRIVE"]
    dev = set(drive_fixed["development"])
    held = set(drive_fixed["held_out"])
    test = set(drive_fixed.get("official_test", []))

    # Disjointness
    assert len(dev.intersection(held)) == 0, "DRIVE dev and held_out must be disjoint"
    assert len(dev.intersection(test)) == 0, "DRIVE dev and official_test must be disjoint"
    assert len(held.intersection(test)) == 0, "DRIVE held_out and official_test must be disjoint"

    # Exact expected counts
    assert len(dev) == 15, f"Expected 15 DRIVE dev images, got {len(dev)}"
    assert len(held) == 5, f"Expected 5 DRIVE held-out images, got {len(held)}"
    assert len(test) == 20, f"Expected 20 DRIVE official test images, got {len(test)}"

def test_drishti_splits_disjoint_and_complete(manifests):
    drishti_fixed = manifests["fixed"]["Drishti-GS"]
    dev = set(drishti_fixed["development"])
    held = set(drishti_fixed["held_out"])
    test = set(drishti_fixed.get("official_test", []))

    assert len(dev.intersection(held)) == 0, "Drishti-GS dev and held_out must be disjoint"
    assert len(dev.intersection(test)) == 0, "Drishti-GS dev and official_test must be disjoint"
    assert len(held.intersection(test)) == 0, "Drishti-GS held_out and official_test must be disjoint"

    assert len(dev) == 35, f"Expected 35 Drishti-GS dev images, got {len(dev)}"
    assert len(held) == 15, f"Expected 15 Drishti-GS held-out images, got {len(held)}"
    assert len(test) == 51, f"Expected 51 Drishti-GS official test images, got {len(test)}"

def test_manifest_records_integrity(manifests):
    comp = manifests["comp"]
    for dataset_name in ["DRIVE", "Drishti-GS"]:
        records = comp[dataset_name]
        canonical_ids = [r["canonical_id"] for r in records]
        assert len(canonical_ids) == len(set(canonical_ids)), f"Duplicate canonical_ids found in {dataset_name}"

        for r in records:
            assert r["split"] in ["development", "held_out", "official_test", "test"]
            assert r["inclusion_or_exclusion_reason"], "Missing inclusion_or_exclusion_reason"
            img_p = DATASETS_DIR / r["image_path"]
            assert img_p.exists(), f"Source image does not exist: {img_p}"

            if dataset_name == "DRIVE" and r["split"] in ["development", "held_out"]:
                assert r["annotation_path"] is not None, f"Required vessel annotation path missing for {r['canonical_id']}"
                ann_p = DATASETS_DIR / r["annotation_path"]
                assert ann_p.exists(), f"Vessel annotation file missing: {ann_p}"

            if dataset_name == "Drishti-GS":
                assert r["disc_gt_path"] is not None, f"Required disc GT path missing for {r['canonical_id']}"
                assert r["cup_gt_path"] is not None, f"Required cup GT path missing for {r['canonical_id']}"
                assert (DATASETS_DIR / r["disc_gt_path"]).exists(), f"Disc GT missing: {r['disc_gt_path']}"
                assert (DATASETS_DIR / r["cup_gt_path"]).exists(), f"Cup GT missing: {r['cup_gt_path']}"
