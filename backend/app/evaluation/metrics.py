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
