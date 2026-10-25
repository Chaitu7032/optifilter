"""
OptiFilter / MorphoVision - Image Analysis API Router
Endpoints for image inspection and on-demand Track A and Track B segmentation.
"""
from typing import Optional, Dict, Any
import json
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from app.dip.preprocessing import (
    validate_and_load_image,
    estimate_fov_mask,
    extract_green_channel,
    numpy_to_base64_png,
)
from app.dip.vessel_segmentation import segment_retinal_vessels
from app.dip.disc_cup_segmentation import segment_optic_disc_and_cup
from app.evaluation.dataset_adapters import get_all_adapters

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/inspect")
async def inspect_image(
    file: Optional[UploadFile] = File(None),
    dataset_name: Optional[str] = Form(None),
    item_id: Optional[str] = Form(None),
):
    """Inspects an image, validating dimensions, channels, and providing a quick FOV preview."""
    try:
        rgb_image = None
        if file is not None and file.filename:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            rgb_image, meta = validate_and_load_image(content)
        elif dataset_name and item_id:
            adapters = get_all_adapters()
            adapter = adapters.get(dataset_name)
            if not adapter or not adapter.is_installed():
                raise HTTPException(status_code=404, detail="Dataset not installed")
            images = adapter.get_images()
            target = next((item for item in images if item["id"] == item_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="Item ID not found in dataset")
            loaded = adapter.load_item(target)
            rgb_image = loaded["rgb_image"]
            rgb_image, meta = validate_and_load_image(rgb_image)
        else:
            raise HTTPException(status_code=400, detail="Please upload a retinal fundus image to begin.")

        fov_mask, is_estimated = estimate_fov_mask(rgb_image)
        green = extract_green_channel(rgb_image)

        return {
            "metadata": meta,
            "is_fov_estimated": is_estimated,
            "previews": {
                "original": numpy_to_base64_png(rgb_image),
                "fov_mask": numpy_to_base64_png(fov_mask),
                "green_channel": numpy_to_base64_png(green),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/vessels")
async def analyze_vessels(
    file: Optional[UploadFile] = File(None),
    gt_file: Optional[UploadFile] = File(None),
    dataset_name: Optional[str] = Form(None),
    item_id: Optional[str] = Form(None),
    config_json: Optional[str] = Form(None),
):
    """Executes Track A Retinal Vessel Segmentation with inspectable intermediate outputs."""
    try:
        rgb_image = None
        fov_mask = None
        vessel_gt = None

        if file is not None and file.filename:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            rgb_image, _ = validate_and_load_image(content)

            # Optional uploaded ground-truth reference mask
            if gt_file is not None and gt_file.filename:
                gt_content = await gt_file.read()
                if gt_content:
                    import cv2
                    nparr = np.frombuffer(gt_content, np.uint8)
                    gt_img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
                    if gt_img is not None:
                        if gt_img.shape[:2] != rgb_image.shape[:2]:
                            gt_img = cv2.resize(gt_img, (rgb_image.shape[1], rgb_image.shape[0]), interpolation=cv2.INTER_NEAREST)
                        vessel_gt = (gt_img > 127).astype(np.uint8) * 255
        elif dataset_name and item_id:
            adapters = get_all_adapters()
            adapter = adapters.get(dataset_name)
            if not adapter or not adapter.is_installed():
                raise HTTPException(status_code=404, detail="Dataset not installed")
            images = adapter.get_images()
            target = next((item for item in images if item["id"] == item_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="Item ID not found in dataset")
            loaded = adapter.load_item(target)
            rgb_image = loaded["rgb_image"]
            fov_mask = loaded.get("fov_mask")
            vessel_gt = loaded.get("vessel_gt")
        else:
            raise HTTPException(status_code=400, detail="Please upload a retinal fundus image before running analysis.")

        config = json.loads(config_json) if config_json else None

        result = segment_retinal_vessels(
            rgb_image,
            fov_mask=fov_mask,
            config=config,
            return_intermediate_images=True,
        )

        # Ground truth evaluation ONLY if authentic reference mask is provided
        metrics = None
        if vessel_gt is not None:
            from app.evaluation.metrics import calculate_segmentation_metrics
            metrics = calculate_segmentation_metrics(
                result["binary_mask"],
                vessel_gt,
                mask=fov_mask if fov_mask is not None else (np.ones(rgb_image.shape[:2], dtype=bool)),
            )

        # Remove raw non-serializable numpy array before returning JSON
        result.pop("binary_mask", None)
        result["ground_truth_metrics"] = metrics  # None if no reference mask provided
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/disc-cup")
async def analyze_disc_cup(
    file: Optional[UploadFile] = File(None),
    gt_disc_file: Optional[UploadFile] = File(None),
    gt_cup_file: Optional[UploadFile] = File(None),
    dataset_name: Optional[str] = Form(None),
    item_id: Optional[str] = Form(None),
    config_json: Optional[str] = Form(None),
):
    """Executes Track B Optic Disc and Cup Segmentation with strictly bounded active contours."""
    try:
        rgb_image = None
        fov_mask = None
        disc_gt = None
        cup_gt = None

        if file is not None and file.filename:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            rgb_image, _ = validate_and_load_image(content)

            import cv2
            if gt_disc_file is not None and gt_disc_file.filename:
                d_content = await gt_disc_file.read()
                if d_content:
                    d_nparr = np.frombuffer(d_content, np.uint8)
                    d_img = cv2.imdecode(d_nparr, cv2.IMREAD_GRAYSCALE)
                    if d_img is not None:
                        if d_img.shape[:2] != rgb_image.shape[:2]:
                            d_img = cv2.resize(d_img, (rgb_image.shape[1], rgb_image.shape[0]), interpolation=cv2.INTER_NEAREST)
                        disc_gt = (d_img > 127).astype(np.uint8) * 255

            if gt_cup_file is not None and gt_cup_file.filename:
                c_content = await gt_cup_file.read()
                if c_content:
                    c_nparr = np.frombuffer(c_content, np.uint8)
                    c_img = cv2.imdecode(c_nparr, cv2.IMREAD_GRAYSCALE)
                    if c_img is not None:
                        if c_img.shape[:2] != rgb_image.shape[:2]:
                            c_img = cv2.resize(c_img, (rgb_image.shape[1], rgb_image.shape[0]), interpolation=cv2.INTER_NEAREST)
                        cup_gt = (c_img > 127).astype(np.uint8) * 255

        elif dataset_name and item_id:
            adapters = get_all_adapters()
            adapter = adapters.get(dataset_name)
            if not adapter or not adapter.is_installed():
                raise HTTPException(status_code=404, detail="Dataset not installed")
            images = adapter.get_images()
            target = next((item for item in images if item["id"] == item_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="Item ID not found in dataset")
            loaded = adapter.load_item(target)
            rgb_image = loaded["rgb_image"]
            fov_mask = loaded.get("fov_mask")
            disc_gt = loaded.get("disc_gt")
            cup_gt = loaded.get("cup_gt")
        else:
            raise HTTPException(status_code=400, detail="Please upload a retinal fundus image before running analysis.")

        config = json.loads(config_json) if config_json else None

        result = segment_optic_disc_and_cup(
            rgb_image,
            fov_mask=fov_mask,
            gt_disc_mask=disc_gt,
            gt_cup_mask=cup_gt,
            config=config,
            return_intermediate_images=True,
        )

        # Remove raw numpy arrays
        result.pop("binary_disc_mask", None)
        result.pop("binary_cup_mask", None)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
