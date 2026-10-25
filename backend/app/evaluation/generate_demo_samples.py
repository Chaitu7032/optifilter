"""
OptiFilter / MorphoVision - Demo Fundus Sample Generator
Generates medically plausible synthetic fundus images with ground-truth masks
for out-of-the-box pipeline validation and benchmark demonstration.
Deterministic, reproducible, with zero random hallucinations.
"""
from pathlib import Path
import json
import numpy as np
import cv2
from app.config import DEMO_SAMPLES_DIR


def generate_sample(
    sample_id: str,
    width: int = 512,
    height: int = 512,
    disc_pos: tuple = (160, 256),  # (cx, cy)
    disc_radius_x: int = 42,
    disc_radius_y: int = 46,
    cup_radius_x: int = 18,
    cup_radius_y: int = 21,
    noise_seed: int = 42,
) -> dict:
    np.random.seed(noise_seed)
    h, w = height, width
    cy, cx = h // 2, w // 2

    # 1. Circular FOV
    y_grid, x_grid = np.ogrid[:h, :w]
    fov_radius = int(min(h, w) * 0.46)
    dist_sq = (x_grid - cx)**2 + (y_grid - cy)**2
    fov_mask = (dist_sq <= fov_radius**2).astype(np.uint8) * 255

    # 2. Base Fundus Background (vignetted red-orange fundus reflectance)
    # R: 180..220, G: 70..100, B: 20..40
    norm_dist = np.sqrt(dist_sq) / fov_radius
    norm_dist = np.clip(norm_dist, 0.0, 1.0)

    # Fundus gradient
    red_ch = (210 - 45 * norm_dist).astype(np.uint8)
    green_ch = (90 - 25 * norm_dist).astype(np.uint8)
    blue_ch = (30 - 15 * norm_dist).astype(np.uint8)

    fundus = np.dstack([red_ch, green_ch, blue_ch])
    # Add subtle organic choroidal texture
    texture = (np.random.randn(h, w) * 3).astype(np.int16)
    fundus = np.clip(fundus.astype(np.int16) + texture[:, :, None], 0, 255).astype(np.uint8)

    # 3. Fovea (macula: darker central depression temporal to optic disc)
    # Macula center temporal to disc
    macula_cx = cx + 80
    macula_cy = cy
    macula_dist = np.sqrt((x_grid - macula_cx)**2 + (y_grid - macula_cy)**2)
    macula_falloff = np.exp(-((macula_dist / 38.0)**2))
    fundus[:, :, 0] = np.clip(fundus[:, :, 0] - (40 * macula_falloff), 0, 255).astype(np.uint8)
    fundus[:, :, 1] = np.clip(fundus[:, :, 1] - (30 * macula_falloff), 0, 255).astype(np.uint8)

    # 4. Optic Disc & Cup
    dx, dy = disc_pos
    disc_dist = ((x_grid - dx) / disc_radius_x)**2 + ((y_grid - dy) / disc_radius_y)**2
    cup_dist = ((x_grid - dx) / cup_radius_x)**2 + ((y_grid - dy) / cup_radius_y)**2

    disc_gt = (disc_dist <= 1.0).astype(np.uint8) * 255
    cup_gt = (cup_dist <= 1.0).astype(np.uint8) * 255
    # Strict containment
    cup_gt = (cup_gt > 0) & (disc_gt > 0)
    cup_gt = (cup_gt.astype(np.uint8) * 255)

    # Paint Optic Disc (orange-yellowish bright structure)
    disc_pixels = disc_gt > 0
    fundus[disc_pixels, 0] = 245
    fundus[disc_pixels, 1] = 190
    fundus[disc_pixels, 2] = 95

    # Paint Optic Cup (pale yellow-white central depression)
    cup_pixels = cup_gt > 0
    fundus[cup_pixels, 0] = 255
    fundus[cup_pixels, 1] = 240
    fundus[cup_pixels, 2] = 185

    # Blur disc boundaries slightly to simulate physiological transition
    fundus_smooth = cv2.GaussianBlur(fundus, (5, 5), sigmaX=1.0)
    fundus = np.where(disc_pixels[:, :, None], fundus_smooth, fundus)

    # 5. Vessel Tree Generation
    vessel_gt = np.zeros((h, w), dtype=np.uint8)

    # Generate main vascular arches originating from optic disc
    curves = [
        # Superior temporal arcade
        [(dx, dy), (dx + 40, dy - 60), (dx + 120, dy - 120), (dx + 220, dy - 130), (dx + 290, dy - 100)],
        # Inferior temporal arcade
        [(dx, dy), (dx + 40, dy + 60), (dx + 120, dy + 120), (dx + 220, dy + 130), (dx + 290, dy + 100)],
        # Superior nasal arcade
        [(dx, dy), (dx - 40, dy - 60), (dx - 90, dy - 100), (dx - 110, dy - 150)],
        # Inferior nasal arcade
        [(dx, dy), (dx - 40, dy + 60), (dx - 90, dy + 100), (dx - 110, dy + 150)],
        # Secondary branches
        [(dx + 120, dy - 120), (dx + 150, dy - 80), (dx + 180, dy - 50)],
        [(dx + 120, dy + 120), (dx + 150, dy + 80), (dx + 180, dy + 50)],
        [(dx + 220, dy - 130), (dx + 260, dy - 160)],
        [(dx + 220, dy + 130), (dx + 260, dy + 160)],
    ]

    for c_idx, pts in enumerate(curves):
        pts_arr = np.array(pts, np.int32).reshape((-1, 1, 2))
        thickness = 4 if c_idx < 4 else 2
        cv2.polylines(vessel_gt, [pts_arr], isClosed=False, color=255, thickness=thickness)

    # Smooth vessels slightly
    vessel_gt = (vessel_gt > 100).astype(np.uint8) * 255
    vessel_gt[fov_mask == 0] = 0

    # Draw vessels onto fundus image (dark red/brown absorbing green spectrum)
    vessel_bool = vessel_gt > 0
    fundus[vessel_bool, 0] = np.clip(fundus[vessel_bool, 0] - 80, 20, 255)
    fundus[vessel_bool, 1] = np.clip(fundus[vessel_bool, 1] - 70, 10, 255)
    fundus[vessel_bool, 2] = np.clip(fundus[vessel_bool, 2] - 20, 5, 255)

    # Zero-out everything outside FOV
    fundus[fov_mask == 0] = [0, 0, 0]

    # File paths
    out_dir = DEMO_SAMPLES_DIR
    img_file = out_dir / f"{sample_id}_fundus.png"
    fov_file = out_dir / f"{sample_id}_fov.png"
    vessel_file = out_dir / f"{sample_id}_vessels_gt.png"
    disc_file = out_dir / f"{sample_id}_disc_gt.png"
    cup_file = out_dir / f"{sample_id}_cup_gt.png"

    # Save PNGs
    cv2.imwrite(str(img_file), cv2.cvtColor(fundus, cv2.COLOR_RGB2BGR))
    cv2.imwrite(str(fov_file), fov_mask)
    cv2.imwrite(str(vessel_file), vessel_gt)
    cv2.imwrite(str(disc_file), disc_gt)
    cv2.imwrite(str(cup_file), cup_gt)

    v_disc_diam = 2 * disc_radius_y + 1
    v_cup_diam = 2 * cup_radius_y + 1
    vcdr = round(float(v_cup_diam / v_disc_diam), 4)

    return {
        "id": sample_id,
        "dataset": "BundledDemo",
        "split": "dev" if "dev" in sample_id else "held_out",
        "image_path": str(img_file),
        "fov_mask_path": str(fov_file),
        "vessel_gt_path": str(vessel_file),
        "disc_gt_path": str(disc_file),
        "cup_gt_path": str(cup_file),
        "gt_vertical_cdr": vcdr,
        "resolution": f"{w}x{h}",
    }


def generate_all_demo_samples():
    DEMO_SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    samples = [
        # Sample 1: Normal Eye (vCDR = 0.38)
        generate_sample("sample_01_dev", 512, 512, disc_pos=(160, 256), disc_radius_x=40, disc_radius_y=44, cup_radius_x=16, cup_radius_y=17, noise_seed=101),
        # Sample 2: Healthy Eye (vCDR = 0.44)
        generate_sample("sample_02_dev", 512, 512, disc_pos=(155, 250), disc_radius_x=42, disc_radius_y=46, cup_radius_x=18, cup_radius_y=20, noise_seed=202),
        # Sample 3: Moderate Cup (vCDR = 0.52)
        generate_sample("sample_03_dev", 512, 512, disc_pos=(165, 260), disc_radius_x=44, disc_radius_y=48, cup_radius_x=22, cup_radius_y=25, noise_seed=303),
        # Sample 4: Held-out Test Eye (vCDR = 0.46)
        generate_sample("sample_04_held_out", 512, 512, disc_pos=(158, 252), disc_radius_x=41, disc_radius_y=45, cup_radius_x=19, cup_radius_y=21, noise_seed=404),
    ]

    manifest_path = DEMO_SAMPLES_DIR / "demo_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(samples, f, indent=2)

    print(f"Generated {len(samples)} high-fidelity demo fundus samples in {DEMO_SAMPLES_DIR}")
    return samples


if __name__ == "__main__":
    generate_all_demo_samples()
