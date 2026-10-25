"""
Unit tests for Preprocessing Module (backend/app/dip/preprocessing.py)
"""
import numpy as np
import pytest
from app.dip.preprocessing import (
    validate_and_load_image,
    extract_green_channel,
    apply_clahe,
    estimate_fov_mask,
    numpy_to_base64_png,
)


def test_validate_and_load_image_array():
    """Verify loading from synthetic RGB numpy array."""
    test_img = np.full((100, 120, 3), 128, dtype=np.uint8)
    rgb, meta = validate_and_load_image(test_img)
    assert rgb.shape == (100, 120, 3)
    assert meta["height"] == 100
    assert meta["width"] == 120
    assert meta["channels"] == 3
    # Check immutability
    assert rgb.flags.writeable is False


def test_validate_and_load_image_too_small():
    """Should reject images with dimension < 32px."""
    tiny = np.zeros((16, 16, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="too low"):
        validate_and_load_image(tiny)


def test_green_channel_extraction():
    """Verify green channel is accurately isolated."""
    img = np.zeros((50, 50, 3), dtype=np.uint8)
    img[:, :, 0] = 50   # Red
    img[:, :, 1] = 180  # Green
    img[:, :, 2] = 20   # Blue

    green = extract_green_channel(img)
    assert green.shape == (50, 50)
    assert np.all(green == 180)


def test_clahe_enhancement():
    """Verify CLAHE preserves dimension and type."""
    gray = np.linspace(0, 255, 64 * 64, dtype=np.uint8).reshape((64, 64))
    enhanced = apply_clahe(gray, clip_limit=2.0, tile_grid_size=8)
    assert enhanced.shape == (64, 64)
    assert enhanced.dtype == np.uint8


def test_estimate_fov_mask():
    """Verify FOV estimation separates illuminated center from black boundary."""
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    # Circular illuminated region
    y, x = np.ogrid[:100, :100]
    dist_from_center = (x - 50)**2 + (y - 50)**2
    img[dist_from_center <= 40**2] = [180, 100, 50]

    fov, is_estimated = estimate_fov_mask(img)
    assert is_estimated is True
    assert fov.shape == (100, 100)
    assert fov[50, 50] == 255
    assert fov[5, 5] == 0


def test_numpy_to_base64_png():
    """Verify base64 PNG data URI generation."""
    img = np.zeros((32, 32, 3), dtype=np.uint8)
    uri = numpy_to_base64_png(img)
    assert uri.startswith("data:image/png;base64,")
    assert len(uri) > 50
