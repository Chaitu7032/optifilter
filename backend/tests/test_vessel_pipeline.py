"""
Unit tests for Track A: Retinal Vessel Segmentation (backend/app/dip/vessel_segmentation.py)
"""
import numpy as np
import pytest
from app.dip.vessel_segmentation import segment_retinal_vessels


def create_synthetic_fundus_with_vessel(h=120, w=120):
    """Generates synthetic fundus with illuminated circle and dark simulated vessel lines."""
    img = np.zeros((h, w, 3), dtype=np.uint8)
    # Background circular retina (orange-red: R=180, G=90, B=30)
    cy, cx = h // 2, w // 2
    r_disc = int(min(h, w) * 0.42)
    y, x = np.ogrid[:h, :w]
    circle_mask = (x - cx)**2 + (y - cy)**2 <= r_disc**2
    img[circle_mask] = [180, 90, 30]

    # Draw dark vessels across green channel (G=20 vs G=90)
    # Horizontal line
    img[cy - 2 : cy + 2, cx - 30 : cx + 30, 1] = 20
    # Vertical line
    img[cy - 30 : cy + 30, cx - 2 : cx + 2, 1] = 20

    fov = (circle_mask.astype(np.uint8) * 255)
    return img, fov


def test_vessel_pipeline_execution():
    """Verify end-to-end execution of vessel segmentation."""
    img, fov = create_synthetic_fundus_with_vessel(100, 100)
    res = segment_retinal_vessels(img, fov_mask=fov)

    assert res["success"] is True
    assert res["binary_mask"].shape == (100, 100)
    assert 0.0 <= res["vessel_density"] <= 1.0
    assert res["vessel_pixel_count"] > 0
    assert "preprocessing" in res["telemetry"]["stages_ms"]
    assert "vesselness" in res["telemetry"]["stages_ms"]
    assert "thresholding" in res["telemetry"]["stages_ms"]
    assert res["telemetry"]["total_ms"] > 0


def test_vessel_pipeline_fov_exclusion():
    """Vessel predictions must be strictly restricted to the valid FOV."""
    img, fov = create_synthetic_fundus_with_vessel(100, 100)
    res = segment_retinal_vessels(img, fov_mask=fov)

    pred_mask = res["binary_mask"]
    outside_fov = fov == 0
    # Pixels outside FOV must be 0
    assert np.all(pred_mask[outside_fov] == 0)


def test_vessel_pipeline_intermediate_images():
    """Check that intermediate images are correctly generated and encoded."""
    img, fov = create_synthetic_fundus_with_vessel(80, 80)
    res = segment_retinal_vessels(img, fov_mask=fov, return_intermediate_images=True)

    intermediates = res["intermediate_images"]
    assert "original" in intermediates
    assert "green_channel" in intermediates
    assert "clahe_enhanced" in intermediates
    assert "frangi_heatmap" in intermediates
    assert "binary_mask" in intermediates
    assert "overlay" in intermediates
    for key, uri in intermediates.items():
        assert uri.startswith("data:image/png;base64,")
