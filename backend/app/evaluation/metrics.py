"""
OptiFilter / MorphoVision - Classical Evaluation Metrics
Strictly evaluated within the Field-of-View (FOV) mask.
Numerically stable, deterministic, and independently verifiable.
"""
from typing import Dict, Optional, Tuple, Any
import numpy as np


def compute_confusion_matrix(
    y_pred: np.ndarray,
    y_true: np.ndarray,
    mask: Optional[np.ndarray] = None,
) -> Tuple[int, int, int, int]:
    """
    Computes (TP, FP, FN, TN) inside the valid FOV mask.
    
    Args:
        y_pred: Binary predicted mask (H, W), boolean or numeric {0, 1}
        y_true: Binary ground truth mask (H, W), boolean or numeric {0, 1}
        mask: Optional binary FOV mask (H, W). If None, all pixels are evaluated.
        
    Returns:
        (TP, FP, FN, TN) as integers.
    """
    pred_bool = (y_pred > 0).astype(bool)
    true_bool = (y_true > 0).astype(bool)

    if mask is not None:
        fov_bool = (mask > 0).astype(bool)
        pred_bool = pred_bool[fov_bool]
        true_bool = true_bool[fov_bool]
    else:
        pred_bool = pred_bool.ravel()
        true_bool = true_bool.ravel()

    tp = int(np.count_nonzero(pred_bool & true_bool))
    fp = int(np.count_nonzero(pred_bool & ~true_bool))
    fn = int(np.count_nonzero(~pred_bool & true_bool))
    tn = int(np.count_nonzero(~pred_bool & ~true_bool))

    return tp, fp, fn, tn


def calculate_segmentation_metrics(
    y_pred: np.ndarray,
    y_true: np.ndarray,
    mask: Optional[np.ndarray] = None,
) -> Dict[str, float]:
    """
    Computes standard segmentation metrics inside the FOV:
    - Dice Similarity Coefficient (F1-score)
    - Intersection over Union (IoU / Jaccard)
    - Sensitivity (Recall / TPR)
    - Specificity (TNR)
    - Precision (PPV)
    - False Positive Rate (FPR)
    - Accuracy
    
    Safe edge-case handling:
    - If both pred and true have zero positive pixels in FOV: Dice=1.0, IoU=1.0, Sensitivity=1.0, Specificity=1.0, Precision=1.0, FPR=0.0
    - If true is empty but pred is non-empty: Sensitivity=1.0, Precision=0.0, Dice=0.0, IoU=0.0
    - If pred is empty but true is non-empty: Precision=0.0, Sensitivity=0.0, Dice=0.0, IoU=0.0
    """
    tp, fp, fn, tn = compute_confusion_matrix(y_pred, y_true, mask)
    total_pixels = tp + fp + fn + tn

    if total_pixels == 0:
        return {
            "dice": 0.0,
            "iou": 0.0,
            "sensitivity": 0.0,
            "specificity": 0.0,
            "precision": 0.0,
            "fpr": 0.0,
            "accuracy": 0.0,
            "tp": 0,
            "fp": 0,
            "fn": 0,
            "tn": 0,
        }

    positives_true = tp + fn
    positives_pred = tp + fp
    negatives_true = tn + fp

    # Dice coefficient: 2*TP / (2*TP + FP + FN)
    dice_denom = 2 * tp + fp + fn
    if dice_denom == 0:
        dice = 1.0 if (positives_true == 0 and positives_pred == 0) else 0.0
    else:
        dice = float(2.0 * tp / dice_denom)

    # Intersection over Union: TP / (TP + FP + FN)
    iou_denom = tp + fp + fn
    if iou_denom == 0:
        iou = 1.0 if (positives_true == 0 and positives_pred == 0) else 0.0
    else:
        iou = float(tp / iou_denom)

    # Sensitivity / Recall: TP / (TP + FN)
    if positives_true == 0:
        sensitivity = 1.0 if positives_pred == 0 else 0.0
    else:
        sensitivity = float(tp / positives_true)

    # Specificity: TN / (TN + FP)
    if negatives_true == 0:
        specificity = 1.0 if fp == 0 else 0.0
    else:
        specificity = float(tn / negatives_true)

    # Precision: TP / (TP + FP)
    if positives_pred == 0:
        precision = 1.0 if positives_true == 0 else 0.0
    else:
        precision = float(tp / positives_pred)

    # False Positive Rate: FP / (FP + TN) = 1 - Specificity
    fpr = 1.0 - specificity

    # Overall Accuracy in FOV
    accuracy = float((tp + tn) / total_pixels) if total_pixels > 0 else 0.0

    return {
        "dice": round(dice, 4),
        "iou": round(iou, 4),
        "sensitivity": round(sensitivity, 4),
        "specificity": round(specificity, 4),
        "precision": round(precision, 4),
        "fpr": round(fpr, 4),
        "accuracy": round(accuracy, 4),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
    }


def compute_vertical_diameter(binary_mask: np.ndarray) -> int:
    """
    Computes the maximum vertical extent (height) of a binary mask.
    Returns:
        int: Maximum vertical span in pixels (0 if empty).
    """
    y_coords, _ = np.nonzero(binary_mask > 0)
    if len(y_coords) == 0:
        return 0
    return int(np.max(y_coords) - np.min(y_coords) + 1)


def compute_vertical_cdr(
    disc_mask: np.ndarray,
    cup_mask: np.ndarray,
) -> Dict[str, Any]:
    """
    Calculates Vertical Cup-to-Disc Ratio (vCDR) and geometric parameters.
    
    Formula:
        vCDR = vertical_cup_diameter / vertical_disc_diameter
        
    Returns:
        dict containing vertical diameters, areas, vCDR, and validity state.
    """
    disc_v_diam = compute_vertical_diameter(disc_mask)
    cup_v_diam = compute_vertical_diameter(cup_mask)
    disc_area = int(np.count_nonzero(disc_mask > 0))
    cup_area = int(np.count_nonzero(cup_mask > 0))

    if disc_v_diam <= 0:
        return {
            "is_valid": False,
            "disc_vertical_diameter": 0,
            "cup_vertical_diameter": cup_v_diam,
            "disc_area": disc_area,
            "cup_area": cup_area,
            "vcdr": None,
            "warning": "Disc vertical diameter is non-positive or empty.",
        }

    vcdr = float(cup_v_diam / disc_v_diam)
    # Physical/anatomical reality check: cup should not exceed disc
    warning = None
    if vcdr > 1.0:
        warning = "Cup vertical diameter exceeds disc vertical diameter."

    return {
        "is_valid": True,
        "disc_vertical_diameter": disc_v_diam,
        "cup_vertical_diameter": cup_v_diam,
        "disc_area": disc_area,
        "cup_area": cup_area,
        "vcdr": round(vcdr, 4),
        "warning": warning,
    }


def calculate_cdr_error(
    pred_vcdr: Optional[float],
    gt_vcdr: Optional[float],
) -> Optional[float]:
    """
    Calculates absolute vertical CDR error: |vCDR_pred - vCDR_gt|.
    Returns None if either value is invalid.
    """
    if pred_vcdr is None or gt_vcdr is None:
        return None
    return round(float(abs(pred_vcdr - gt_vcdr)), 4)


def compute_bland_altman(
    y_pred: np.ndarray,
    y_ref: np.ndarray,
) -> Dict[str, float]:
    """
    Performs standard Bland-Altman agreement analysis on paired measurements.
    
    Formula:
        diff = y_pred - y_ref
        bias = mean(diff)
        sd_diff = sample standard deviation (ddof=1)
        loa_lower = bias - 1.96 * sd_diff
        loa_upper = bias + 1.96 * sd_diff
    """
    p = np.asarray(y_pred, dtype=float)
    r = np.asarray(y_ref, dtype=float)
    if len(p) != len(r) or len(p) < 2:
        return {
            "n": len(p),
            "bias": 0.0,
            "sd_diff": 0.0,
            "loa_lower": 0.0,
            "loa_upper": 0.0,
        }

    diffs = p - r
    bias = float(np.mean(diffs))
    sd_diff = float(np.std(diffs, ddof=1))
    loa_lower = bias - 1.96 * sd_diff
    loa_upper = bias + 1.96 * sd_diff

    return {
        "n": int(len(p)),
        "bias": round(bias, 4),
        "sd_diff": round(sd_diff, 4),
        "loa_lower": round(loa_lower, 4),
        "loa_upper": round(loa_upper, 4),
    }


def compute_cdr_summary_statistics(
    y_pred: np.ndarray,
    y_ref: np.ndarray,
) -> Dict[str, Any]:
    """
    Computes complete statistical agreement suite for vCDR:
    - Sample count (N)
    - Mean Absolute Error (MAE)
    - Median Absolute Error (MedAE)
    - Root Mean Square Error (RMSE)
    - Pearson correlation (r, p-value)
    - Spearman rank correlation (rho, p-value)
    - Bland-Altman agreement metrics
    """
    from scipy import stats

    p = np.asarray(y_pred, dtype=float)
    r = np.asarray(y_ref, dtype=float)
    n = len(p)

    if n == 0 or len(r) != n:
        return {
            "n": 0,
            "mae": None,
            "medae": None,
            "rmse": None,
            "pearson_r": None,
            "pearson_p": None,
            "spearman_rho": None,
            "spearman_p": None,
            "bland_altman": None,
        }

    abs_errs = np.abs(p - r)
    mae = float(np.mean(abs_errs))
    medae = float(np.median(abs_errs))
    rmse = float(np.sqrt(np.mean((p - r) ** 2)))

    # Correlations (check for zero variance / constant arrays)
    if n >= 2 and np.std(p) > 1e-9 and np.std(r) > 1e-9:
        pearson_r, pearson_p = stats.pearsonr(p, r)
        spearman_rho, spearman_p = stats.spearmanr(p, r)
    else:
        pearson_r, pearson_p = 0.0, 1.0
        spearman_rho, spearman_p = 0.0, 1.0

    ba = compute_bland_altman(p, r)

    return {
        "n": int(n),
        "mae": round(mae, 4),
        "medae": round(medae, 4),
        "rmse": round(rmse, 4),
        "pearson_r": round(float(pearson_r), 4),
        "pearson_p": round(float(pearson_p), 4),
        "spearman_rho": round(float(spearman_rho), 4),
        "spearman_p": round(float(spearman_p), 4),
        "bland_altman": ba,
    }


def aggregate_statistics(values: np.ndarray) -> Dict[str, float]:
    """
    Calculates sample summary statistics:
    - n
    - mean
    - sample standard deviation (ddof=1)
    - median
    - interquartile range (IQR)
    - 95% Confidence Interval for the mean (t-distribution)
    """
    from scipy import stats

    v = np.asarray(values, dtype=float)
    v = v[~np.isnan(v)]
    n = len(v)

    if n == 0:
        return {"n": 0, "mean": 0.0, "std": 0.0, "median": 0.0, "iqr": 0.0, "ci95_low": 0.0, "ci95_high": 0.0}

    mean_val = float(np.mean(v))
    median_val = float(np.median(v))
    iqr_val = float(np.percentile(v, 75) - np.percentile(v, 25))

    if n > 1:
        std_val = float(np.std(v, ddof=1))
        se = std_val / np.sqrt(n)
        ci_span = float(stats.t.ppf(0.975, df=n - 1) * se)
        ci95_low = mean_val - ci_span
        ci95_high = mean_val + ci_span
    else:
        std_val = 0.0
        ci95_low = mean_val
        ci95_high = mean_val

    return {
        "n": int(n),
        "mean": round(mean_val, 4),
        "std": round(std_val, 4),
        "median": round(median_val, 4),
        "iqr": round(iqr_val, 4),
        "ci95_low": round(ci95_low, 4),
        "ci95_high": round(ci95_high, 4),
    }

