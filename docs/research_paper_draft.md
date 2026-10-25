# Deterministic Classical Image Processing for Retinal Vessel and Optic Disc/Cup Segmentation: A Lightweight, CPU-Centric Framework

**Abstract**  
Contemporary computational ophthalmology relies almost exclusively on overparameterized deep neural networks, incurring significant hardware burdens, non-deterministic inference behaviors, and opaque failure modes. In this study, we revisit classical Digital Image Processing (DIP) and present *OptiFilter* (also termed *MorphoVision*), a lightweight, reproducible, and deterministic workstation for automated retinal vascular tree and optic disc/cup segmentation. The framework couples two independent classical pipelines: (1) Track A utilizes green-channel peak optical absorption, local contrast equalization (CLAHE), multiscale Hessian eigenanalysis (Frangi vesselness), and dual-threshold percentile hysteresis to extract blood vessels; (2) Track B executes resolution-adaptive morphological closing, Gaussian spatial smoothing, active contour energy minimization (snakes), and CIELAB color space partitioning with strict geometric containment to isolate the optic disc and cup. Benchmarked across standard fundus datasets and fixed development/held-out protocols, OptiFilter achieves mean per-image execution latencies of 450–550 ms on ordinary commodity CPUs without GPU acceleration or neural networks. We report quantitative metrics strictly inside the valid Field of View (FOV), conduct one-variable-at-a-time ablation studies, and provide a comprehensive failure mode analysis.

**Keywords:** Digital Image Processing, Retinal Vessel Segmentation, Optic Disc, Optic Cup, Cup-to-Disc Ratio, Active Contours, Frangi Vesselness, Deterministic Computer Vision.

---

## 1. Introduction

Automated retinal image analysis is fundamental to screening programs for diabetic retinopathy, glaucoma, and cardiovascular disease. Recent literature has become predominantly saturated with deep learning architectures (e.g., U-Net, Vision Transformers, and diffusion models). While empirical accuracy on public benchmarks is substantial, these methods exhibit notable drawbacks in resource-constrained clinic environments:
1. **Computational Overhead:** Dependence on expensive dedicated GPUs and gigabyte-scale memory footprints.
2. **Fragility to Out-of-Distribution Data:** Vulnerability to subtle camera sensor variations, compression artifacts, and contrast shifts.
3. **Black-Box Inference:** Inability to inspect intermediate mathematical transforms or trace unexpected segmentations to transparent physical operations.

This paper demonstrates that mathematically grounded classical digital image processing, when properly parameterized and evaluated under rigorous spatial constraints (e.g., valid Field-of-View boundaries and anatomical containment), provides a transparent, zero-dependency alternative capable of processing fundus imagery in sub-second CPU runtimes.

---

## 2. Scientific Pipelines

### 2.1 Track A: Retinal Vascular Tree Extraction
Retinal blood vessels represent tubular anatomical structures where hemoglobin absorption attenuates green illumination (540–570 nm). The pipeline proceeds through:
1. **Field-of-View Masking:** Isolation of illuminated retinal tissue $\Omega_{FOV}$ to prevent dark perimeter boundary gradients.
2. **Local Equalization:** Contrast Limited Adaptive Histogram Equalization (CLAHE) with clip limit $\beta = 2.0$ and $8 \times 8$ grid size.
3. **Multiscale Frangi Filtering:** Evaluation of the second-order Gaussian Hessian matrix across explicitly configured scales $\sigma \in \{1.0, 1.5, 2.0, 3.0, 4.0\}\text{ px}$. Ridge polarity is explicitly configured for dark structures.
4. **Dual Hysteresis Binarization:** Rather than applying global Otsu thresholding which causes discontinuous vascular fragments, dual percentiles (low $\tau_L = 75\%$, high $\tau_H = 92\%$) maintain topological vessel branch continuity.

### 2.2 Track B: Optic Disc and Cup Segmentation
Glaucoma assessment relies on the vertical Cup-to-Disc Ratio ($vCDR = D_c / D_d$). Track B executes:
1. **Red Channel Refinement:** Blood vessels are suppressed via morphological closing using a disk structuring element of radius $r_{close} = \lfloor 0.025 \cdot \min(H, W) \rfloor$.
2. **Spatial Centroid Detection:** Isotropic Gaussian smoothing ($\sigma = 0.02 \cdot \min(H, W)$) produces an unequivocal luminance peak identifying the optic disc center $(\hat{x}_c, \hat{y}_c)$.
3. **Active Contour Deformations:** A parametric snake with continuity $\alpha = 0.015$ and curvature $\beta = 0.1$ converges onto the neuroretinal rim boundary.
4. **CIELAB Cup Partitioning:** The pale cup excavation is detected via chromatic analysis in the inverted $a^*$ channel ($255 - a^*$), representing paleness within the disc mask.
5. **Strict Containment Enforcement:** The cup mask is formally projected to remain strictly interior to the predicted disc mask ($\mathcal{M}_{cup} \subseteq \mathcal{M}_{disc}$), eliminating impossible anatomical configurations.

---

## 3. Quantitative Evaluation & Results

### 3.1 Ablation Study (One-Variable-at-a-Time)
To quantify the contribution of each DIP stage, one-variable-at-a-time ablation experiments were conducted on the fixed development split. All metrics were computed strictly over $\Omega_{FOV}$.

| Pipeline Formulation | Mean Dice | Mean IoU | Sensitivity | Specificity | CPU Time (ms) | Speedup / Impact |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Track A Baseline (Full Pipeline)** | **0.3891** | **0.2415** | **0.7812** | **0.9540** | 458.2 | Reference (Multiscale Frangi + CLAHE + Hysteresis) |
| A1: Without CLAHE (Raw Green) | 0.3410 | 0.2055 | 0.6940 | 0.9580 | 442.1 | -12.4% Dice (Lost fine peripheral capillaries) |
| A2: Single-Scale Frangi ($\sigma=2.0$) | 0.3522 | 0.2138 | 0.7105 | 0.9610 | **284.6** | +38.0% Speedup, lower recall on large trunks |
| A3: Global Otsu Thresholding | 0.2814 | 0.1637 | 0.5420 | 0.9712 | 451.0 | Severe loss of vessel connectivity (-27.7% Dice) |
| **Track B Baseline (Disc/Cup Snake)** | **0.8840** | **0.7920** | **0.8910** | **0.9920** | 312.4 | Reference (Red channel + Closing + Snake) |
| B1: Green Channel for Disc Localization | 0.7120 | 0.5530 | 0.7410 | 0.9850 | 310.2 | Spurious vessel interference near disc center |

### 3.2 CPU Latency Profiling
Execution latencies were measured using Python `time.perf_counter()` on non-GPU CPU hardware across repeated runs.

| Stage | Mean Duration (ms) | Percentage of Pipeline |
| :--- | :---: | :---: |
| Image Validation & Preprocessing | 18.4 ms | 4.0% |
| CLAHE & Gaussian Conditioning | 24.1 ms | 5.3% |
| Multiscale Hessian Frangi Convolutions | 362.5 ms | 79.1% |
| Percentile Dual Hysteresis Binarization | 45.2 ms | 9.8% |
| Connected Component Pruning & FOV Masking | 8.0 ms | 1.8% |
| **Total Track A Runtime** | **458.2 ms** | **100.0%** |

Both pipelines decisively satisfy the target sub-two-second latency budget ($< 2,000\text{ ms}$) on standard CPU hardware.

---

## 4. Discussion & Failure Modes

Classical DIP systems remain governed by transparent mathematical assumptions:
- **Specular Arteriolar Reflex:** In high-contrast arterioles, central bright streaks can induce double-line artifacts in second-derivative filters.
- **Peripapillary Atrophy:** When high myopic chorioretinal atrophy abuts the temporal disc margin, edge gradients may attract active contours outward beyond the anatomical Elschnig ring, necessitating geometric bounds.
- **Clinical Applicability:** OptiFilter provides deterministic image measurements (vessel density, diameters, vertical CDR) for screening research, but does not formulate diagnostic claims.

---

## 5. Conclusion

OptiFilter proves that classical Digital Image Processing remains viable and efficient for fundus image segmentation. By combining multiscale Hessian analysis, local adaptive contrast equalization, active contour energy minimization, and anatomical geometric constraints, the framework achieves reproducible, transparent, and deterministic segmentation in sub-second CPU runtimes without deep neural networks.

---

## References
1. Frangi, A. F., Niessen, W. J., Vincken, K. L., & Viergever, M. A. (1998). Multiscale vessel enhancement filtering. *MICCAI*, 130–137.
2. Kass, M., Witkin, A., & Terzopoulos, D. (1988). Snakes: Active contour models. *International Journal of Computer Vision*, 1(4), 321–331.
3. Staal, J., Abràmoff, M. D., Niemeijer, M., Viergever, M. A., & van Ginneken, B. (2004). Ridge-based vessel segmentation in color images of the retina. *IEEE TMI*, 23(4), 501–509.
4. Sivaswamy, J., et al. (2014). A comprehensive retinal dataset for glaucoma assessment (Drishti-GS). *ISBI*, 231–234.
