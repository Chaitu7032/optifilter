"""
OptiFilter / MorphoVision - Dataset Adapters & Bundled Demo Samples
Standardized dataset abstraction for DRIVE, Drishti-GS, STARE, and Bundled Demo Samples.
Includes fixed deterministic train/dev/held-out manifests with recorded seeds.
"""
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

from app.config import DATASETS_DIR, MANIFESTS_DIR


class DatasetAdapter:
    """Abstract base adapter for retinal fundus benchmarks."""

    def __init__(self, name: str, root_dir: Path):
        self.name = name
        self.root_dir = Path(root_dir)

    def is_installed(self) -> bool:
        return self.root_dir.exists() and any(self.root_dir.iterdir())

    def get_images(self, split: str = "all") -> List[Dict[str, Any]]:
        raise NotImplementedError

    def load_item(self, item_id: str) -> Dict[str, Any]:
        raise NotImplementedError


class DriveAdapter(DatasetAdapter):
    """Adapter for DRIVE (Digital Retinal Images for Vessel Extraction) dataset."""

    def __init__(self, root_dir: Path = DATASETS_DIR / "DRIVE"):
        if not (root_dir.exists() and any(root_dir.iterdir())):
            alt_candidates = [
                DATASETS_DIR / "Drive retinal" / "DRIVE",
                DATASETS_DIR / "Drive retinal",
                DATASETS_DIR / "drive" / "DRIVE",
                DATASETS_DIR / "drive",
            ]
            for cand in alt_candidates:
                if cand.exists() and (cand / "training" / "images").exists():
                    root_dir = cand
                    break
        super().__init__("DRIVE", root_dir)
        self.splits_file = MANIFESTS_DIR / "fixed_splits.json"

    def is_installed(self) -> bool:
        if not self.root_dir.exists():
            return False
        train_dir = self.root_dir / "training" / "images"
        test_dir = self.root_dir / "test" / "images"
        return train_dir.exists() or test_dir.exists()

    def get_images(self, split: str = "all") -> List[Dict[str, Any]]:
        if not self.is_installed():
            return []

        # Load fixed development/held-out manifests
        fixed_dev = []
        fixed_held = []
        if self.splits_file.exists():
            try:
                with open(self.splits_file, "r") as f:
                    splits_data = json.load(f)
                    fixed_dev = splits_data.get("DRIVE", {}).get("development", [])
                    fixed_held = splits_data.get("DRIVE", {}).get("held_out", [])
            except Exception:
                pass

        split_norm = split.lower().strip()
        search_dirs = []
        if split_norm in ["all", "training", "train", "development", "dev", "held_out", "heldout"]:
            search_dirs.append((self.root_dir / "training", "training"))
        if split_norm in ["all", "test"]:
            search_dirs.append((self.root_dir / "test", "test"))

        items = []
        for s_dir, s_name in search_dirs:
            img_dir = s_dir / "images"
            if not img_dir.exists():
                continue
            for img_path in sorted(img_dir.glob("*.tif")):
                stem = img_path.stem.replace("_training", "").replace("_test", "")
                raw_stem = img_path.stem  # e.g. "21_training"
                gt_path = s_dir / "1st_manual" / f"{stem}_manual1.gif"
                mask_path = s_dir / "mask" / f"{stem}_{s_name}_mask.gif"

                assigned_subsplit = "development" if raw_stem in fixed_dev else ("held_out" if raw_stem in fixed_held else s_name)

                if split_norm in ["development", "dev"] and raw_stem not in fixed_dev:
                    continue
                if split_norm in ["held_out", "heldout"] and raw_stem not in fixed_held:
                    continue

                items.append({
                    "id": f"drive_{s_name}_{stem}",
                    "raw_id": raw_stem,
                    "dataset": "DRIVE",
                    "split": assigned_subsplit if s_name == "training" else s_name,
                    "image_path": str(img_path),
                    "vessel_gt_path": str(gt_path) if gt_path.exists() else None,
                    "fov_mask_path": str(mask_path) if mask_path.exists() else None,
                })
        return items

    def load_item(self, item_dict: Any) -> Dict[str, Any]:
        if isinstance(item_dict, str):
            all_items = self.get_images("all")
            matched = next(
                (it for it in all_items if it["id"] == item_dict or it.get("raw_id") == item_dict or item_dict in it["image_path"]),
                None
            )
            if not matched:
                raise ValueError(f"Item '{item_dict}' not found in DRIVE dataset.")
            item_dict = matched

        bgr = cv2.imread(item_dict["image_path"])
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        
        vessel_gt = None
        if item_dict.get("vessel_gt_path") and Path(item_dict["vessel_gt_path"]).exists():
            v_pil = Image.open(item_dict["vessel_gt_path"]).convert("L")
            vessel_gt = (np.array(v_pil) > 0).astype(np.uint8) * 255

        fov = None
        if item_dict.get("fov_mask_path") and Path(item_dict["fov_mask_path"]).exists():
            f_pil = Image.open(item_dict["fov_mask_path"]).convert("L")
            fov = (np.array(f_pil) > 0).astype(np.uint8) * 255

        return {
            "id": item_dict["id"],
            "rgb_image": rgb,
            "fov_mask": fov,
            "vessel_gt": vessel_gt,
            "disc_gt": None,
            "cup_gt": None,
        }


class DrishtiGSAdapter(DatasetAdapter):
    """Adapter for Drishti-GS dataset (Optic Disc and Cup segmentation)."""

    def __init__(self, root_dir: Path = DATASETS_DIR / "Drishti-GS"):
        if not (root_dir.exists() and any(root_dir.iterdir())):
            alt_candidates = [
                DATASETS_DIR / "Dristhi GS",
                DATASETS_DIR / "drishti-gs",
                DATASETS_DIR / "drishti_gs",
            ]
            for cand in alt_candidates:
                if cand.exists() and any(cand.iterdir()):
                    root_dir = cand
                    break
        super().__init__("Drishti-GS", root_dir)
        self.splits_file = MANIFESTS_DIR / "fixed_splits.json"

    def is_installed(self) -> bool:
        if not self.root_dir.exists():
            return False
        # Check if any .png fundus files exist
        pngs = list(self.root_dir.rglob("*.png"))
        return len(pngs) > 10

    def get_images(self, split: str = "all") -> List[Dict[str, Any]]:
        if not self.is_installed():
            return []

        # Load fixed development/held-out splits
        fixed_dev = []
        fixed_held = []
        if self.splits_file.exists():
            try:
                with open(self.splits_file, "r") as f:
                    splits_data = json.load(f)
                    fixed_dev = splits_data.get("Drishti-GS", {}).get("development", [])
                    fixed_held = splits_data.get("Drishti-GS", {}).get("held_out", [])
            except Exception:
                pass

        split_norm = split.lower().strip()
        items = []

        # Find all fundus images (excluding ground-truth/softmap/boundary files)
        all_pngs = sorted(self.root_dir.rglob("*.png"))
        fundus_imgs = [
            p for p in all_pngs
            if "GT" not in p.parts and "Test_GT" not in p.parts and "SoftMap" not in p.parts and "AvgBoundary" not in p.parts
        ]

        for img_path in fundus_imgs:
            stem = img_path.stem  # e.g. "drishtiGS_002"
            path_str = str(img_path).lower()
            s_name = "test" if "test" in path_str else "training"

            assigned_subsplit = "development" if stem in fixed_dev else ("held_out" if stem in fixed_held else s_name)

            if split_norm in ["development", "dev"] and stem not in fixed_dev:
                continue
            if split_norm in ["held_out", "heldout"] and stem not in fixed_held:
                continue
            if split_norm in ["training", "train"] and s_name != "training":
                continue
            if split_norm in ["test"] and s_name != "test":
                continue

            # Locate ground truth folder for this stem
            gt_dirs = [d for d in self.root_dir.rglob(stem) if d.is_dir() and ("GT" in d.parts or "Test_GT" in d.parts)]
            gt_dir = gt_dirs[0] if gt_dirs else None

            disc_gt = None
            cup_gt = None
            cdr_txt = None

            if gt_dir:
                # Find SoftMap files
                soft_od = list(gt_dir.glob("**/*OD*soft*")) or list(gt_dir.glob("**/*OD*Soft*")) or list(gt_dir.glob("**/*OD*"))
                soft_cup = list(gt_dir.glob("**/*cup*soft*")) or list(gt_dir.glob("**/*cup*Soft*")) or list(gt_dir.glob("**/*cup*"))
                if soft_od:
                    disc_gt = str(soft_od[0])
                if soft_cup:
                    cup_gt = str(soft_cup[0])
                
                cdr_files = list(gt_dir.glob("**/*cdr*"))
                if cdr_files:
                    cdr_txt = str(cdr_files[0])

            items.append({
                "id": f"drishti_{s_name}_{stem}",
                "raw_id": stem,
                "dataset": "Drishti-GS",
                "split": assigned_subsplit if s_name == "training" else s_name,
                "image_path": str(img_path),
                "disc_gt_path": disc_gt,
                "cup_gt_path": cup_gt,
                "cdr_txt_path": cdr_txt,
            })

        return items

    def load_item(self, item_dict: Any) -> Dict[str, Any]:
        if isinstance(item_dict, str):
            all_items = self.get_images("all")
            matched = next(
                (it for it in all_items if it["id"] == item_dict or it.get("raw_id") == item_dict or item_dict in it["image_path"]),
                None
            )
            if not matched:
                raise ValueError(f"Item '{item_dict}' not found in Drishti-GS dataset.")
            item_dict = matched

        bgr = cv2.imread(item_dict["image_path"])
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        
        disc_gt = None
        if item_dict.get("disc_gt_path") and Path(item_dict["disc_gt_path"]).exists():
            d_img = cv2.imread(item_dict["disc_gt_path"], cv2.IMREAD_GRAYSCALE)
            # Drishti-GS SoftMap: consensus >= 0.5 (majority vote threshold)
            disc_gt = (d_img > 127).astype(np.uint8) * 255

        cup_gt = None
        if item_dict.get("cup_gt_path") and Path(item_dict["cup_gt_path"]).exists():
            c_img = cv2.imread(item_dict["cup_gt_path"], cv2.IMREAD_GRAYSCALE)
            # Drishti-GS SoftMap: consensus >= 0.5 (majority vote threshold)
            cup_gt = (c_img > 127).astype(np.uint8) * 255

        # Reference CDR from expert ground truth text file (mean of expert ratings)
        ref_vcdr = None
        if item_dict.get("cdr_txt_path") and Path(item_dict["cdr_txt_path"]).exists():
            try:
                with open(item_dict["cdr_txt_path"], "r") as f:
                    vals = [float(x) for x in f.read().split() if x.strip()]
                    if vals:
                        ref_vcdr = round(float(np.mean(vals)), 4)
            except Exception:
                pass

        return {
            "id": item_dict["id"],
            "raw_id": item_dict.get("raw_id"),
            "rgb_image": rgb,
            "fov_mask": None,
            "vessel_gt": None,
            "disc_gt": disc_gt,
            "cup_gt": cup_gt,
            "ref_vcdr": ref_vcdr,
        }


def get_all_adapters() -> Dict[str, DatasetAdapter]:
    """Returns mapping of available real dataset adapters."""
    return {
        "DRIVE": DriveAdapter(),
        "Drishti-GS": DrishtiGSAdapter(),
    }
