"""
Unit tests for Track B: Optic Disc and Cup Segmentation (backend/app/dip/disc_cup_segmentation.py)
"""
import numpy as np
import pytest
from app.dip.disc_cup_segmentation import segment_optic_disc_and_cup


def create_synthetic_fundus_with_disc_and_cup(h=140, w=140):
    """Generates synthetic fundus with illuminated retina, bright optic disc, and paler cup."""
    img = np.zeros((h, w, 3), dtype=np.uint8)
    cy, cx = h // 2, w // 2
    r_retina = int(min(h, w) * 0.44)
    y, x = np.ogrid[:h, :w]

    # Retina background: R=170, G=70, B=25
    retina_mask = (x - cx)**2 + (y - cy)**2 <= r_retina**2
    img[retina_mask] = [170, 70, 25]

    # Optic Disc: located at (cx + 25, cy), radius 18, high red & yellow: R=250, G=200, B=100
    disc_cx, disc_cy = cx + 20, cy
    r_disc = 18
    disc_geom = (x - disc_cx)**2 + (y - disc_cy)**2 <= r_disc**2
    img[disc_geom] = [250, 200, 100]

    # Optic Cup: located inside disc, radius 8, pale yellow-white: R=255, G=240, B=180
    r_cup = 8
    cup_geom = (x - disc_cx)**2 + (y - disc_cy)**2 <= r_cup**2
    img[cup_geom] = [255, 240, 180]

    fov = (retina_mask.astype(np.uint8) * 255)
    gt_disc = (disc_geom.astype(np.uint8) * 255)
    gt_cup = (cup_geom.astype(np.uint8) * 255)
    return img, fov, gt_disc, gt_cup


def test_disc_cup_pipeline_containment():
    """CRITICAL TEST: Optic cup must be strictly contained inside the optic disc mask."""
    img, fov, gt_disc, gt_cup = create_synthetic_fundus_with_disc_and_cup()
    res = segment_optic_disc_and_cup(img, fov_mask=fov)

    assert res["success"] is True
    disc_mask = res["binary_disc_mask"]
    cup_mask = res["binary_cup_mask"]

    # Every pixel in cup_mask must also be positive in disc_mask
    cup_outside_disc = (cup_mask > 0) & (disc_mask == 0)
    assert np.count_nonzero(cup_outside_disc) == 0, "Optic cup violated disc containment constraint!"


def test_disc_cup_vcdr_validity():
    """Vertical CDR must be a valid float between 0.0 and 1.0."""
    img, fov, gt_disc, gt_cup = create_synthetic_fundus_with_disc_and_cup()
    res = segment_optic_disc_and_cup(img, fov_mask=fov)

    vcdr = res["vertical_cdr"]
    assert vcdr is not None
    assert 0.0 < vcdr <= 1.0
    assert res["disc_diameter_vertical_px"] > 0
    assert res["cup_diameter_vertical_px"] > 0
    assert res["cup_diameter_vertical_px"] <= res["disc_diameter_vertical_px"]


def test_disc_cup_with_ground_truth_metrics():
    """When GT masks are passed, segmentation metrics and CDR error must be returned."""
    img, fov, gt_disc, gt_cup = create_synthetic_fundus_with_disc_and_cup()
    res = segment_optic_disc_and_cup(
        img,
        fov_mask=fov,
        gt_disc_mask=gt_disc,
        gt_cup_mask=gt_cup,
    )

    assert res["disc_metrics"] is not None
    assert res["disc_metrics"]["dice"] > 0.6  # High overlap with synthetic disc
    assert res["cup_metrics"] is not None
    assert res["cdr_absolute_error"] is not None
    assert res["cdr_absolute_error"] < 0.25
