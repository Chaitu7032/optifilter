"""
OptiFilter / MorphoVision - System Configuration & Constants
Defines storage paths, default DIP hyperparameters, and environment validation.
"""
from pathlib import Path
import os
import platform
import sys

# Base Directory paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATASETS_DIR = DATA_DIR / "datasets"
DEMO_SAMPLES_DIR = DATA_DIR / "demo_samples"
ARTIFACTS_DIR = DATA_DIR / "artifacts"
MANIFESTS_DIR = DATA_DIR / "manifests"
DB_PATH = DATA_DIR / "optifilter.db"

# Ensure runtime directories exist
for path in [DATA_DIR, DATASETS_DIR, DEMO_SAMPLES_DIR, ARTIFACTS_DIR, MANIFESTS_DIR]:
    path.mkdir(parents=True, exist_ok=True)

# System Metadata
SYSTEM_METADATA = {
    "os": platform.platform(),
    "python_version": sys.version.split()[0],
    "machine": platform.machine(),
    "processor": platform.processor(),
}

# Image Processing Limits
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".ppm", ".bmp"}

# Default Parameters for Track A: Vessel Segmentation
DEFAULT_VESSEL_CONFIG = {
    "clahe_clip_limit": 2.0,
    "clahe_tile_grid_size": 8,
    "gaussian_denoise_sigma": 0.5,
    "frangi_sigmas": [1.0, 1.5, 2.0, 3.0, 4.0],
    "frangi_alpha": 0.5,
    "frangi_beta": 0.5,
    "frangi_gamma": 15.0,
    "hysteresis_low_percentile": 75.0,
    "hysteresis_high_percentile": 92.0,
    "min_component_size": 25,
    "use_clahe": True,
    "threshold_method": "hysteresis",  # "hysteresis" or "global_otsu" or "global_percentile"
}

# Default Parameters for Track B: Optic Disc & Cup Segmentation
DEFAULT_DISC_CUP_CONFIG = {
    "disc_channel": "red",            # "red", "green", "gray", "clahe_green"
    "morph_closing_factor": 0.025,    # disk radius ~ 0.025 * min(H, W)
    "gaussian_smooth_factor": 0.020,  # sigma ~ 0.020 * min(H, W)
    "disc_snake_alpha": 0.015,        # active contour continuity
    "disc_snake_beta": 0.1,           # active contour curvature/smoothness
    "disc_snake_gamma": 0.01,
    "disc_snake_max_iterations": 100,
    "cup_channel": "green",           # "lab_a", "green", "inverted_red" — green empirically +19.4pp Dev Dice
    "cup_snake_alpha": 0.02,
    "cup_snake_beta": 0.1,
    "cup_snake_max_iterations": 80,
    "cup_threshold_factor": 0.65,     # fallback thresholding within disc
    "enforce_containment": True,
}
