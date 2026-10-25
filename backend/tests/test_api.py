import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import init_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def get_test_png_bytes(h=120, w=120):
    img = np.zeros((h, w, 3), dtype=np.uint8)
    cy, cx = h // 2, w // 2
    r_disc = int(min(h, w) * 0.42)
    y, x = np.ogrid[:h, :w]
    circle_mask = (x - cx)**2 + (y - cy)**2 <= r_disc**2
    img[circle_mask] = [180, 90, 30]
    img[cy - 2 : cy + 2, cx - 30 : cx + 30, 1] = 20
    # Disc
    disc_mask = (x - (cx + 15))**2 + (y - cy)**2 <= 14**2
    img[disc_mask] = [245, 190, 95]
    _, buf = cv2.imencode(".png", img)
    return buf.tobytes()


def test_health_check_endpoint():
    """Verify health endpoint and deterministic guarantees."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["ai_free_guarantee"] is True
    assert data["classical_dip_only"] is True
    assert "system" in data


def test_datasets_discovery_endpoint():
    """Verify dataset discovery returns supported real benchmark adapters without demo datasets."""
    res = client.get("/api/v1/benchmarks/datasets")
    assert res.status_code == 200
    datasets = res.json()
    assert isinstance(datasets, list)
    names = [d["name"] for d in datasets]
    assert "BundledDemo" not in names
    assert "DRIVE" in names
    assert "Drishti-GS" in names


def test_inspect_endpoint_with_uploaded_image():
    """Verify image inspection on an uploaded fundus scan."""
    png_bytes = get_test_png_bytes(200, 200)
    res = client.post(
        "/api/v1/analysis/inspect",
        files={"file": ("fundus_scan.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["metadata"]["height"] == 200
    assert data["metadata"]["width"] == 200
    assert "original" in data["previews"]
    assert "green_channel" in data["previews"]
    assert "fov_mask" in data["previews"]


def test_vessel_analysis_endpoint_uploaded_image():
    """Verify Track A vessel analysis execution on an uploaded image without ground truth."""
    png_bytes = get_test_png_bytes(100, 100)
    res = client.post(
        "/api/v1/analysis/vessels",
        files={"file": ("user_eye.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "vessel_density" in data
    assert "telemetry" in data
    assert "intermediate_images" in data
    assert "frangi_heatmap" in data["intermediate_images"]
    assert "overlay" in data["intermediate_images"]
    # Ground truth metrics must be strictly None when no reference mask is provided
    assert data["ground_truth_metrics"] is None


def test_disc_cup_analysis_endpoint_uploaded_image():
    """Verify Track B disc & cup analysis execution on an uploaded image."""
    png_bytes = get_test_png_bytes(120, 120)
    res = client.post(
        "/api/v1/analysis/disc-cup",
        files={"file": ("user_retina.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["vertical_cdr"] is not None
    assert 0.0 < data["vertical_cdr"] <= 1.0
    # Ground truth metrics must be strictly None when no reference mask is provided
    assert data["disc_metrics"] is None
    assert data["cup_metrics"] is None
    assert data["cdr_absolute_error"] is None


def test_clean_empty_state_error_handling():
    """Endpoints must cleanly reject requests with no input rather than defaulting to demos."""
    res_inspect = client.post("/api/v1/analysis/inspect")
    assert res_inspect.status_code == 400

    res_vessels = client.post("/api/v1/analysis/vessels")
    assert res_vessels.status_code == 400

    res_disc = client.post("/api/v1/analysis/disc-cup")
    assert res_disc.status_code == 400

