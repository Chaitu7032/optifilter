"""
Unit Tests for Evaluation Metrics (backend/app/evaluation/metrics.py)
Tests against known synthetic masks and strict edge conditions.
"""
import numpy as np
import pytest
from app.evaluation.metrics import (
    compute_confusion_matrix,
    calculate_segmentation_metrics,
    compute_vertical_diameter,
    compute_vertical_cdr,
    calculate_cdr_error,
)


def test_identical_masks():
    """Identical masks should produce Dice = 1.0, IoU = 1.0, Sensitivity = 1.0, Specificity = 1.0."""
    mask = np.zeros((20, 20), dtype=np.uint8)
    mask[5:15, 5:15] = 1

    metrics = calculate_segmentation_metrics(mask, mask)
    assert metrics["dice"] == 1.0
    assert metrics["iou"] == 1.0
    assert metrics["sensitivity"] == 1.0
    assert metrics["specificity"] == 1.0
    assert metrics["precision"] == 1.0
    assert metrics["fpr"] == 0.0
    assert metrics["accuracy"] == 1.0


def test_disjoint_masks():
    """Disjoint nonempty masks should produce Dice = 0.0, IoU = 0.0, Sensitivity = 0.0, Precision = 0.0."""
    pred = np.zeros((30, 30), dtype=np.uint8)
    true = np.zeros((30, 30), dtype=np.uint8)
    pred[0:10, 0:10] = 1
    true[20:30, 20:30] = 1

    metrics = calculate_segmentation_metrics(pred, true)
    assert metrics["dice"] == 0.0
    assert metrics["iou"] == 0.0
    assert metrics["sensitivity"] == 0.0
    assert metrics["precision"] == 0.0
    assert metrics["tp"] == 0
    assert metrics["fp"] == 100
    assert metrics["fn"] == 100
    assert metrics["tn"] == 700


def test_manual_known_confusion_matrix():
    """Verify exact formula on manually constructed matrix."""
    pred = np.array([
        [1, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ], dtype=np.uint8)
    true = np.array([
        [1, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ], dtype=np.uint8)
    # TP: (0,0), (1,1) -> 2
    # FP: (0,1) -> 1
    # FN: (1,2) -> 1
    # TN: 12
    tp, fp, fn, tn = compute_confusion_matrix(pred, true)
    assert (tp, fp, fn, tn) == (2, 1, 1, 12)

    m = calculate_segmentation_metrics(pred, true)
    # Dice = 2*2 / (2*2 + 1 + 1) = 4/6 = 0.6667
    # IoU = 2 / (2 + 1 + 1) = 2/4 = 0.5000
    # Sensitivity = 2 / (2 + 1) = 2/3 = 0.6667
    # Specificity = 12 / (12 + 1) = 12/13 = 0.9231
    # Precision = 2 / (2 + 1) = 2/3 = 0.6667
    assert m["dice"] == 0.6667
    assert m["iou"] == 0.5
    assert m["sensitivity"] == 0.6667
    assert m["specificity"] == 0.9231
    assert m["precision"] == 0.6667


def test_fov_mask_exclusion():
    """Pixels outside the FOV must be completely ignored during evaluation."""
    pred = np.zeros((10, 10), dtype=np.uint8)
    true = np.zeros((10, 10), dtype=np.uint8)
    fov = np.zeros((10, 10), dtype=np.uint8)

    # Valid FOV region is only columns 0-4
    fov[:, 0:5] = 1

    # In FOV: perfect match
    pred[2:4, 1:3] = 1
    true[2:4, 1:3] = 1

    # Outside FOV: massive mismatch (which should be excluded)
    pred[:, 6:9] = 1
    true[:, 8:10] = 1

    metrics = calculate_segmentation_metrics(pred, true, mask=fov)
    assert metrics["dice"] == 1.0
    assert metrics["iou"] == 1.0
    assert metrics["sensitivity"] == 1.0
    assert metrics["precision"] == 1.0
    # Total evaluated pixels should be exactly 50 (10 x 5)
    assert metrics["tp"] + metrics["fp"] + metrics["fn"] + metrics["tn"] == 50


def test_empty_mask_handling():
    """Both empty masks in FOV must return 1.0 across metrics."""
    empty1 = np.zeros((10, 10), dtype=np.uint8)
    empty2 = np.zeros((10, 10), dtype=np.uint8)

    m = calculate_segmentation_metrics(empty1, empty2)
    assert m["dice"] == 1.0
    assert m["iou"] == 1.0
    assert m["sensitivity"] == 1.0
    assert m["specificity"] == 1.0
    assert m["precision"] == 1.0


def test_vertical_diameter_and_vcdr():
    """Verify vertical diameter measurement and CDR computation."""
    disc = np.zeros((50, 50), dtype=np.uint8)
    cup = np.zeros((50, 50), dtype=np.uint8)

    # Disc from y=10 to y=39 (span = 30)
    disc[10:40, 10:40] = 1
    # Cup from y=19 to y=30 (span = 12)
    cup[19:31, 18:32] = 1

    assert compute_vertical_diameter(disc) == 30
    assert compute_vertical_diameter(cup) == 12

    cdr_res = compute_vertical_cdr(disc, cup)
    assert cdr_res["is_valid"] is True
    assert cdr_res["disc_vertical_diameter"] == 30
    assert cdr_res["cup_vertical_diameter"] == 12
    assert cdr_res["vcdr"] == 0.4
    assert cdr_res["warning"] is None

    # Error calculation against a reference ground truth vCDR of 0.38
    err = calculate_cdr_error(cdr_res["vcdr"], 0.38)
    assert err == 0.02


def test_degenerate_disc_handling():
    """Empty disc should return is_valid=False and None vcdr."""
    empty_disc = np.zeros((20, 20), dtype=np.uint8)
    some_cup = np.zeros((20, 20), dtype=np.uint8)
    some_cup[5:10, 5:10] = 1

    cdr_res = compute_vertical_cdr(empty_disc, some_cup)
    assert cdr_res["is_valid"] is False
    assert cdr_res["vcdr"] is None
    assert "non-positive" in cdr_res["warning"]


def test_bland_altman_synthetic():
    """Verify Bland-Altman agreement calculation with exact manual calculation."""
    from app.evaluation.metrics import compute_bland_altman
    y_pred = np.array([0.5, 0.6, 0.7, 0.8])
    y_ref  = np.array([0.4, 0.5, 0.8, 0.7])
    # diffs = [0.1, 0.1, -0.1, 0.1]
    # mean diff (bias) = (0.1 + 0.1 - 0.1 + 0.1)/4 = 0.2/4 = 0.05
    # diff - mean = [0.05, 0.05, -0.15, 0.05]
    # sum of squares = 0.0025 + 0.0025 + 0.0225 + 0.0025 = 0.03
    # sample variance (ddof=1) = 0.03 / 3 = 0.01
    # sample sd = 0.1
    # loa_lower = 0.05 - 1.96 * 0.1 = -0.146
    # loa_upper = 0.05 + 1.96 * 0.1 = +0.246
    res = compute_bland_altman(y_pred, y_ref)
    assert res["n"] == 4
    assert res["bias"] == 0.05
    assert res["sd_diff"] == 0.1
    assert res["loa_lower"] == -0.146
    assert res["loa_upper"] == 0.246


def test_cdr_summary_statistics_synthetic():
    """Verify MAE, MedAE, RMSE, and correlations on known data."""
    from app.evaluation.metrics import compute_cdr_summary_statistics
    y_pred = np.array([0.5, 0.6, 0.7, 0.8])
    y_ref  = np.array([0.4, 0.5, 0.8, 0.7])
    # abs errs = [0.1, 0.1, 0.1, 0.1] -> MAE = 0.1, MedAE = 0.1, RMSE = 0.1
    res = compute_cdr_summary_statistics(y_pred, y_ref)
    assert res["n"] == 4
    assert res["mae"] == 0.1
    assert res["medae"] == 0.1
    assert res["rmse"] == 0.1
    assert res["pearson_r"] is not None
    assert res["spearman_rho"] is not None


def test_aggregate_statistics_synthetic():
    """Verify sample std, median, IQR, and CI on known values."""
    from app.evaluation.metrics import aggregate_statistics
    data = np.array([10.0, 20.0, 30.0, 40.0, 50.0])
    res = aggregate_statistics(data)
    assert res["n"] == 5
    assert res["mean"] == 30.0
    # sample std of [10, 20, 30, 40, 50] with ddof=1 is sqrt(1000/4) = sqrt(250) = 15.8114
    assert res["std"] == 15.8114
    assert res["median"] == 30.0
    assert res["ci95_low"] < 30.0 < res["ci95_high"]

