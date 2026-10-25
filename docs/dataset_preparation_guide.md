# OptiFilter / MorphoVision — Dataset Preparation Guide

This guide details how to acquire, extract, and structure external benchmark datasets for evaluation within the OptiFilter classical image processing workstation.

## General Principles

- **No Automated Unconsented Downloads:** In accordance with institutional research ethics and dataset licensing agreements, OptiFilter does not silently download external datasets over the internet.
- **Built-in Demonstration Samples:** The application includes 4 high-fidelity reference fundus images (`BundledDemo`) located in `backend/data/demo_samples/` for immediate pipeline testing and ablation exploration without manual downloads.

---

## 1. DRIVE (Digital Retinal Images for Vessel Extraction)

- **Official Source:** [DRIVE Database](https://drive.isi.uu.nl/)
- **Target Task:** Track A — Retinal Vessel Segmentation
- **Annotation Format:** GIF binary vessel masks (`1st_manual`) and GIF circular FOV masks (`mask`).

### Directory Layout
Place the extracted contents into `backend/data/datasets/DRIVE/`:

```
backend/data/datasets/DRIVE/
├── training/
│   ├── images/
│   │   ├── 21_training.tif
│   │   ├── 22_training.tif
│   │   └── ... (up to 40_training.tif)
│   ├── 1st_manual/
│   │   ├── 21_manual1.gif
│   │   └── ...
│   └── mask/
│       ├── 21_training_mask.gif
│       └── ...
└── test/
    ├── images/
    │   ├── 01_test.tif
    │   └── ... (up to 20_test.tif)
    └── mask/
        ├── 01_test_mask.gif
        └── ...
```

---

## 2. Drishti-GS (Glaucoma Screening Benchmark)

- **Target Task:** Track B — Optic Disc and Cup Segmentation, Vertical CDR
- **Annotation Format:** PNG SoftMap and boundary averages.

### Directory Layout
Place the extracted archive into `backend/data/datasets/Drishti-GS/`:

```
backend/data/datasets/Drishti-GS/
├── Drishti-GS_training/
│   ├── Images/
│   │   ├── drishtiGS_001.png
│   │   └── ...
│   └── GT/
│       ├── drishtiGS_001/
│       │   └── SoftMap/
│       │       ├── drishtiGS_001_ODsoftMap.png
│       │       └── drishtiGS_001_cupsoftMap.png
│       └── ...
└── Drishti-GS_test/
    ├── Images/
    └── GT/
```

---

## 3. Fixed Evaluation Protocol

To prevent data snooping and repeatedly overfitting parameters against test images:
1. Optimize algorithm hyperparameters (e.g. Frangi sigmas, CLAHE clip limit, closing radius) strictly on the **development subset**.
2. Freeze all parameters in `backend/app/config.py`.
3. Execute the final quantitative benchmark run once on the **held-out subset** using the fixed split manifests in `backend/data/manifests/fixed_splits.json`.
