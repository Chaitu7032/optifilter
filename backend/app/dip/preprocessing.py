"""
OptiFilter / MorphoVision - Shared Preprocessing Module
Classical Digital Image Processing operations for Retinal Fundus Images.
Immutable inputs, deterministic operations, FOV estimation, and CLAHE.
"""
from typing import Tuple, Optional, Dict, Any
import base64
import io
import cv2
import numpy as np
from PIL import Image


def validate_and_load_image(
    image_input: Any,
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Validates and loads an image into an RGB uint8 NumPy array.
    Supports file path (str or Path), bytes, or existing numpy array.
    Returns:
        rgb_image: Immutable uint8 array with shape (H, W, 3)
        metadata: Dict with height, width, channels, dtype, is_color
    """
    if isinstance(image_input, (str, bytes, bytearray)) or hasattr(image_input, "read"):
        if isinstance(image_input, (bytes, bytearray)):
            file_bytes = np.frombuffer(image_input, np.uint8)
            bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        elif hasattr(image_input, "read"):
            content = image_input.read()
            file_bytes = np.frombuffer(content, np.uint8)
            bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        else:
            bgr = cv2.imread(str(image_input), cv2.IMREAD_COLOR)

        if bgr is None:
            raise ValueError("Failed to decode image. Unsupported or corrupted file format.")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    elif isinstance(image_input, np.ndarray):
        if image_input.ndim == 2:
            rgb = cv2.cvtColor(image_input, cv2.COLOR_GRAY2RGB)
        elif image_input.ndim == 3 and image_input.shape[2] == 3:
            rgb = image_input.copy()
        elif image_input.ndim == 3 and image_input.shape[2] == 4:
            rgb = cv2.cvtColor(image_input, cv2.COLOR_RGBA2RGB)
        else:
            raise ValueError(f"Unsupported numpy array shape: {image_input.shape}")
    else:
        raise TypeError(f"Unsupported image input type: {type(image_input)}")

    if rgb.dtype != np.uint8:
        if np.issubdtype(rgb.dtype, np.floating):
            rgb = np.clip(rgb * 255.0, 0, 255).astype(np.uint8)
        else:
            rgb = rgb.astype(np.uint8)

    h, w, c = rgb.shape
    if h < 32 or w < 32:
        raise ValueError(f"Image resolution too low ({w}x{h}). Minimum required is 32x32.")

    metadata = {
        "height": h,
        "width": w,
        "channels": c,
        "dtype": str(rgb.dtype),
        "aspect_ratio": round(w / h, 4),
    }

    # Make array read-only to enforce immutability of the original input
    rgb.flags.writeable = False
    return rgb, metadata


def extract_green_channel(rgb_image: np.ndarray) -> np.ndarray:
    """
    Extracts the green channel from an RGB fundus image.
    In retinal photography, the green spectrum (540-570 nm) yields peak optical absorption
    by hemoglobin, maximizing vessel-to-background contrast.
    """
    return rgb_image[:, :, 1].copy()


def apply_clahe(
    gray_image: np.ndarray,
    clip_limit: float = 2.0,
    tile_grid_size: int = 8,
) -> np.ndarray:
    """
    Applies Contrast Limited Adaptive Histogram Equalization (CLAHE).
    Prevents over-amplification of noise in homogeneous retinal background.
    """
    clahe = cv2.createCLAHE(
        clipLimit=float(clip_limit),
        tileGridSize=(int(tile_grid_size), int(tile_grid_size)),
    )
    return clahe.apply(gray_image)


def apply_gaussian_denoising(
    image: np.ndarray,
    sigma: float = 0.5,
) -> np.ndarray:
    """Applies isotropic Gaussian blur for mild high-frequency noise suppression."""
    if sigma <= 0:
        return image
    # Kernel size chosen as odd integer >= 3*sigma
    ksize = int(2 * np.ceil(2 * sigma) + 1)
    return cv2.GaussianBlur(image, (ksize, ksize), sigmaX=sigma, sigmaY=sigma)


def estimate_fov_mask(
    rgb_image: np.ndarray,
    threshold_value: int = 15,
) -> Tuple[np.ndarray, bool]:
    """
    Estimates the Field of View (FOV) mask when an official mask is unavailable.
    Method:
      1. Uses the maximum across channels or red channel to separate the illuminated retina from black margins.
      2. Thresholding + morphological closing to fill interior dark spots.
      3. Retains largest connected component.
    Returns:
        mask: uint8 array (H, W) with {0, 255}
        is_estimated: True (indicating FOV is an empirical estimate)
    """
    h, w = rgb_image.shape[:2]
    # Red or max channel gives best boundary definition against black camera aperture
    intensity = np.max(rgb_image, axis=2)

    # Initial threshold
    binary = (intensity > threshold_value).astype(np.uint8) * 255

    # Morphological closing with radius ~ 1.5% of min dimension to fill vessels/fovea
    k_radius = max(3, int(min(h, w) * 0.015))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k_radius + 1, 2 * k_radius + 1))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # Extract largest connected component to eliminate peripheral camera noise
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
    if num_labels <= 1:
        # Fallback to full field if image is unexpectedly uniform
        return np.ones((h, w), dtype=np.uint8) * 255, True

    # Find component with largest area (excluding background label 0)
    largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    fov_mask = np.where(labels == largest_label, 255, 0).astype(np.uint8)

    # Slight erosion to avoid boundary ringing artifacts in Frangi/snakes
    erosion_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fov_mask = cv2.erode(fov_mask, erosion_kernel)

    return fov_mask, True


def numpy_to_base64_png(image: np.ndarray) -> str:
    """Converts a 2D or 3D NumPy array into a base64 encoded PNG data URI string."""
    if image.dtype != np.uint8:
        if np.issubdtype(image.dtype, np.floating):
            normalized = np.clip(image * 255.0, 0, 255).astype(np.uint8)
        else:
            normalized = image.astype(np.uint8)
    else:
        normalized = image

    if normalized.ndim == 2:
        pil_img = Image.fromarray(normalized, mode="L")
    elif normalized.ndim == 3:
        pil_img = Image.fromarray(normalized, mode="RGB")
    else:
        raise ValueError(f"Unsupported dimensions for base64 encoding: {image.ndim}")

    buffer = io.BytesIO()
    pil_img.save(buffer, format="PNG")
    b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"
