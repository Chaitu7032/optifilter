# OptiFilter / MorphoVision

> **Lightweight Classical Digital Image Processing for Retinal Vessel and Optic Disc/Cup Segmentation**  
> *Academic DIP Research Workstation • Deterministic Computer Vision • Strictly Zero AI/ML*

---

## 1. System Overview

OptiFilter (alternative research title: **MorphoVision**) is a complete, research-oriented workstation for retinal fundus image processing developed strictly using classical Digital Image Processing (DIP) techniques.

### Non-Negotiable Scientific Guarantees
- **Strictly No AI / ML:** Zero deep neural networks, zero CNNs, zero learned weights, zero cloud inference APIs, and zero generative synthetic diagnoses.
- **Deterministic & Mathematical:** Built upon OpenCV, SciPy, scikit-image, multiscale Frangi Hessian eigenanalysis, active contours (snakes), adaptive morphology, and CLAHE.
- **Strict Field-of-View (FOV) Masking:** All quantitative metrics (Dice, IoU, Sensitivity, Specificity, Precision, Accuracy) strictly exclude non-illuminated camera borders.
- **Sub-Two-Second CPU Execution:** Designed and profiled to execute full segmentation pipelines in under 2 seconds on commodity laptop CPUs.
- **Strict Anatomical Containment:** The optic cup is geometrically constrained to remain 100% inside the optic disc mask ($\mathcal{M}_{cup} \subseteq \mathcal{M}_{disc}$).

---

## 2. Architecture & Pipeline Tracks

```
                        Retinal Fundus Image (RGB)
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   [Track A: Vessel Extraction]              [Track B: Disc & Cup]
               │                                         │
    Green Channel (540-570nm)                  Red Channel Reflectance
               │                                         │
        CLAHE Equalization                        Morphological Closing
               │                                         │
    Multiscale Frangi Vesselness                Gaussian Luminance Smoothing
   (σ ∈ {1.0, 1.5, 2.0, 3.0, 4.0})                       │
               │                                  Centroid Localization
    Percentile Hysteresis (75/92)                        │
               │                                 Active Contour Snake (Disc)
    Connected Component Pruning                          │
               │                                CIELAB a* Inversion (Cup)
    Vessel Density & Binary Mask                         │
               │                              Strict Containment Enforcement
               │                                         │
               │                              Vertical CDR Calculation (Dc / Dd)
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
                 [Evaluation & Benchmarking Engine]
                       - FOV-Restricted Metrics
                       - CPU Latency & Memory Profiling
                       - One-Variable-at-a-Time Ablations
                       - CSV & JSON Reproducibility Export
```

---

## 3. Directory Layout

```
optifilter/
├── backend/
│   ├── app/
│   │   ├── config.py                 # Hyperparameters, constants, paths
│   │   ├── main.py                   # FastAPI application entrypoint
│   │   ├── db/                       # Embedded SQLite persistence
│   │   ├── dip/
│   │   │   ├── preprocessing.py      # Green extraction, CLAHE, FOV estimation
│   │   │   ├── vessel_segmentation.py# Track A: Frangi multiscale & hysteresis
│   │   │   ├── disc_cup_segmentation.py# Track B: Active contours & strict containment
│   │   │   └── profiling.py          # time.perf_counter() CPU telemetry
│   │   ├── evaluation/
│   │   │   ├── metrics.py            # Dice, IoU, Sensitivity, Specificity, vCDR
│   │   │   ├── dataset_adapters.py   # DRIVE, Drishti-GS, BundledDemo adapters
│   │   │   └── generate_demo_samples.py # Reference synthetic fundus generator
│   │   ├── experiments/
│   │   │   └── runner.py             # Benchmark & ablation experiment engine
│   │   └── routers/                  # REST API endpoints
│   ├── tests/                        # 25 automated unit & integration tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/               # ImageViewer (zoom, pan, coordinate readout), Header
│   │   ├── pages/                    # 6 scientific workstation pages
│   │   ├── services/                 # Typed API client
│   │   └── types/                    # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── methodology.md                # Mathematical formulations & equations
│   ├── research_paper_draft.md       # Academic paper draft with ablation tables
│   ├── dataset_preparation_guide.md  # Setup guide for DRIVE and Drishti-GS
│   └── limitations_and_failure_analysis.md # Known edge cases & failure modes
└── pytest.ini
```

---

## 4. Quickstart Guide

### Prerequisites
- **Python:** 3.11 or 3.12
- **Node.js:** v18+ and npm

### 1. Backend Setup & Startup
From the repository root:

```bash
# 1. Install Python dependencies
pip install -r backend/requirements.txt

# 2. Run automated test suite (verifies all 25 unit and integration tests)
python -m pytest backend/tests/

# 3. Start the FastAPI scientific server (runs on http://127.0.0.1:8000)
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup & Startup
In a separate terminal window:

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Launch Vite development workstation (runs on http://localhost:5173)
npm run dev
```

Open `http://localhost:5173` in your browser. The application connects automatically via proxy to the backend API at `http://127.0.0.1:8000`.

---

## 5. Running Experiments & Benchmarks via CLI

To execute benchmarks and ablations programmatically from the Python terminal:

```python
import sys
sys.path.insert(0, 'backend')

# 1. Run a quantitative benchmark on BundledDemo (dev split)
from app.experiments.runner import execute_benchmark_run
res = execute_benchmark_run('BundledDemo', 'dev', 'vessels')
print(f"Mean Dice: {res['mean_dice']}, Mean CPU Runtime: {res['mean_runtime_ms']} ms")

# 2. Run the one-variable-at-a-time ablation experiment suite
from app.experiments.runner import run_standard_ablation_matrix
runs = run_standard_ablation_matrix('BundledDemo', 'dev')
print(f"Completed {len(runs)} ablation experiments.")
```

---

## 6. Testing

The comprehensive test suite covers all metrics, edge cases, numerical division safety, pipeline constraints, and REST API endpoints:

```bash
python -m pytest backend/tests/ -v
```

All 25 tests execute deterministically on CPU in ~4 seconds without external dependencies.
