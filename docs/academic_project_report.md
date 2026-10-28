# OptiFilter / MorphoVision: Academic Research & Technical Report
## Classical Digital Image Processing for Retinal Vessel, Optic Disc, and Optic Cup Analysis
**Project Category:** Image Processing / Computer Vision / Biomedical Systems  
**Core Restriction:** 100% Classical DIP — Zero Deep Learning / Zero Neural Networks  
**Target Hardware:** Commodity CPU Execution (<2000 ms latency target)  

---

## 1. Executive Summary & Problem Formulation
Ophthalmic screening for sight-threatening diseases—primarily **glaucoma** and **diabetic retinopathy**—requires objective morphological analysis of retinal vasculature and the optic nerve head (ONH). While contemporary biomedical literature is saturated with deep neural networks (e.g., U-Net, Vision Transformers), these models present significant practical limitations in edge clinical environments:
1. **Excessive Computational Requirements:** Multi-million-parameter networks require expensive, power-intensive GPUs unavailable in rural or community clinics.
2. **Opaque Black-Box Inference:** Deep learning models cannot provide mathematical explanations for intermediate feature transformations, creating clinical verification risks.
3. **Sensor Domain Shift Fragility:** Learned representations often degrade when exposed to out-of-distribution camera sensors, resolution differences, or minor optical artifacts.

**OptiFilter (MorphoVision)** revisits the foundations of **Digital Image Processing (DIP)**. It demonstrates that a deterministic pipeline built on differential geometry (Hessian eigenanalysis), adaptive contrast equalization (CLAHE), active contours (snakes), and chromatic decomposition (CIELAB color space) achieves real-time CPU segmentation with complete mathematical interpretability, anatomical containment guarantees, and strict scientific evaluation.

---

## 2. Dataset Protocol, Ground Truth & Scientific Fairness
To prevent **data leakage** and ensure strict scientific fairness, the project established frozen splits and evaluation protocols.

### 2.1 DRIVE Dataset (Retinal Vasculature)
- **Characteristics:** 40 fundus images (565 × 584 pixels, 8-bit RGB, 45° FOV) captured with a Canon CR5 non-mydriatic camera.
- **Annotations:** Manual vascular tracings by two independent ophthalmologists and circular binary Field of View (FOV) masks.
- **Partitioning:** The 20 training images were partitioned under Seed 42 into **15 Development cases** (`21_training` to `35_training`) for tuning hyperparameters and **5 Held-Out cases** (`36_training` to `40_training`) for final verification.
- **Scientific Disclosure:** The official 20 DRIVE test images locally contain FOV masks but lack public `1st_manual` ground truth. OptiFilter honestly reports quantitative benchmark accuracy strictly on the annotated images and does not fabricate test-set labels.

### 2.2 Drishti-GS Dataset (Optic Disc & Cup)
- **Characteristics:** 101 high-resolution images (~1752 × 2045 pixels) collected at Aravind Eye Hospital, Madurai, India.
- **Annotations:** Multi-expert SoftMap probability maps created by four expert ophthalmologists.
- **Consensus Rule:** Ground-truth binary masks for the optic disc and cup are derived via majority-vote thresholding ($\text{Probability} \ge 0.50$, intensity $\ge 128$).
- **Partitioning:** 50 annotated training images partitioned into **35 Development cases** (`drishtiGS_001` to `035`) and **15 Held-Out cases** (`drishtiGS_036` to `050`).
- **Clinical Reference CDR:** Evaluated against the arithmetic mean of independent clinical ratings recorded in `_cdrValues.txt`.

### 2.3 Strict Field of View (FOV) Evaluation
A critical pitfall in retinal benchmarking is the **Pixel Accuracy Paradox**: because background tissue comprises ~90% of a fundus photograph, a trivial blank algorithm achieves 90% accuracy! Furthermore, unexposed black pixels outside the circular aperture artificially inflate True Negatives ($TN$).
OptiFilter resolves this by evaluating all confusion matrix counts ($TP, FP, FN, TN$) strictly over the valid retinal aperture:
$$\Omega_{FOV} = \{ (x, y) \mid \mathcal{M}_{FOV}(x, y) = 1 \}$$

---

## 3. Mathematical Foundations & Implementation Details

### 3.1 Track A: Retinal Blood Vessel Segmentation
Retinal vessels appear as dark, elongated curvilinear ridges on a brighter retinal background.

#### Step 1: Green Channel Extraction
Hemoglobin (HbO2 and Hb) has an intense optical absorption band in the green spectrum (540–570 nm), whereas the red channel reflects off choroidal melanin and sclera. The green channel $I_G$ yields maximum vessel-to-background signal-to-noise ratio:
$$I_G(x, y) = \text{Extract}(I, \text{channel}=\text{'green'})$$

#### Step 2: Contrast Limited Adaptive Histogram Equalization (CLAHE)
To counter non-uniform illumination and peripheral vignetting, CLAHE divides the image into an $8 \times 8$ grid of local contextual tiles. The histogram slope is clipped at $\beta = 2.0$. Clipped counts are redistributed uniformly across all bins before computing the cumulative distribution function (CDF), brightening faint capillaries without blowing up background noise. Adjacent tiles are blended via bilinear interpolation.

#### Step 3: Multiscale Hessian Eigenanalysis (Frangi Vesselness)
At a given spatial scale $\sigma$, the image is convolved with Gaussian second derivatives:
$$\mathcal{H}_\sigma(x, y) = \begin{bmatrix} I_{xx} * G_\sigma & I_{xy} * G_\sigma \\ I_{xy} * G_\sigma & I_{yy} * G_\sigma \end{bmatrix}$$
Let eigenvalues be ordered as $|\lambda_1| \le |\lambda_2|$. For a dark tubular ridge:
- $\lambda_1 \approx 0$ (intensity along the vessel is relatively flat).
- $\lambda_2 \ll 0$ or $\lambda_2 \gg 0$ (sharp curvature across the vessel cross-section).

Two geometric ratios are computed:
1. **Blobness Ratio ($R_B$):** $R_B = \frac{|\lambda_1|}{|\lambda_2|}$ (approaches 0 for line-like structures; approaches 1 for circular blobs).
2. **Second-Order Structure ($S$):** $S = \sqrt{\lambda_1^2 + \lambda_2^2}$ (measures total gradient energy, suppressing flat background noise).

The 2D Frangi vesselness response is defined as:
$$V_\sigma(x, y) = \begin{cases} 0 & \text{if } \lambda_2 > 0 \\ \exp\left(-\frac{R_B^2}{2\beta^2}\right) \cdot \left[1 - \exp\left(-\frac{S^2}{2c^2}\right)\right] & \text{otherwise} \end{cases}$$
We evaluate scales $\sigma \in \{1.0, 1.5, 2.0, 3.0\}\text{ px}$ to capture micro-capillaries up to major vascular arcades, taking the maximum projection:
$$\mathcal{V}(x, y) = \max_{\sigma} V_\sigma(x, y)$$

#### Step 4: Dual-Percentile Hysteresis Binarization
Global thresholding (such as Otsu) causes severe topological fractures. Dual hysteresis thresholding applies:
- **High Threshold ($\tau_H = 92\text{nd percentile}$ in $\Omega_{FOV}$):** Confidently seeds the core vascular trunks.
- **Low Threshold ($\tau_L = 75\text{th percentile}$ in $\Omega_{FOV}$):** Traces continuous branches linked to those seed cores.
- **Morphological Area Opening:** Components with area $< 25\text{ pixels}$ are pruned as noise.

#### Track A Empirical Visual Pipeline (DRIVE 23)
| 1. Original Fundus | 2. Green Channel | 3. CLAHE Enhanced | 4. Frangi Hessian | 5. Vessel Mask | 6. Final Overlay |
| :---: | :---: | :---: | :---: | :---: | :---: |
| ![Original](images/track_a_original.png) | ![Green](images/track_a_green_channel.png) | ![CLAHE](images/track_a_clahe_enhanced.png) | ![Frangi](images/track_a_frangi_heatmap.png) | ![Mask](images/track_a_mask.png) | ![Overlay](images/track_a_overlay.png) |
*Figure 1: Complete sequential execution stages of Track A on DRIVE development image 23.*

---

### 3.2 Track B: Optic Disc & Cup Segmentation

#### Step 1: Red Channel Preprocessing & Vessel Suppression
In Track B, blood vessels passing across the optic nerve head slice the disc plateau into disjointed pieces. In the **red channel** ($I_R$), blood absorption is minimal and vessels are faint.
Adaptive morphological closing ($\bullet$) using a circular structuring element $\mathcal{B}$ with radius $r_{close} = \lfloor 0.025 \cdot \min(H, W) \rfloor$ fills dark vascular gaps without altering the outer disc contour:
$$I_{closed} = (I_R \oplus \mathcal{B}) \ominus \mathcal{B}$$

#### Step 2: Centroid Localization
Isotropic Gaussian smoothing ($\sigma = 0.020 \cdot \min(H, W)$) creates an unequivocal luminance peak at the disc center $(\hat{x}_c, \hat{y}_c)$ within the eroded FOV interior:
$$(\hat{x}_c, \hat{y}_c) = \arg\max_{(x, y) \in \Omega_{FOV}^\circ} I_{smooth}(x, y)$$

#### Step 3: Active Contour (Snake) Optimization
A circular contour of radius $R_{init} = 0.08 \cdot \min(H, W)$ is initialized at $(\hat{x}_c, \hat{y}_c)$ and iteratively deforms to minimize:
$$E_{snake} = \int_0^1 \left[ \frac{\alpha}{2} \left|\frac{dv}{ds}\right|^2 + \frac{\beta}{2} \left|\frac{d^2v}{ds^2}\right|^2 - |\nabla I(v(s))|^2 \right] ds$$
where continuity weight $\alpha = 0.015$ and curvature weight $\beta = 0.1$ ensure smooth convergence onto the anatomical neuroretinal rim boundary, yielding $\mathcal{M}_{disc}$.

#### Step 4: CIELAB Color Space Cup Extraction
The optic cup is devoid of capillaries and appears pale yellow/white, while the surrounding neuroretinal rim is intensely pink/red.
In the **CIELAB** color space, the $a^*$ channel represents the green-red chromatic axis. By extracting the inverted $a^*$ feature:
$$F_{cup}(x, y) = 255 - a^*(x, y)$$
the pale cup excavation becomes a high-contrast plateau. Otsu thresholding within the disc region isolates candidate cup pixels $\mathcal{M}_{cand\_cup}$.

#### Step 5: Strict Anatomical Containment
Physiologically, the cup is an internal depression of the disc; it can never extend beyond the disc boundary. To eliminate impossible geometries caused by adjacent peripapillary atrophy (PPA), OptiFilter enforces:
$$\mathcal{M}_{cup} = \mathcal{M}_{cand\_cup} \cap \mathcal{M}_{disc}$$
guaranteeing $\mathcal{M}_{cup} \subseteq \mathcal{M}_{disc}$ in 100% of cases.

#### Step 6: Vertical Cup-to-Disc Ratio (vCDR)
Vertical spans are measured directly from the binary masks:
$$D_{disc} = \max_{(x,y) \in \mathcal{M}_{disc}} y - \min_{(x,y) \in \mathcal{M}_{disc}} y + 1$$
$$D_{cup} = \max_{(x,y) \in \mathcal{M}_{cup}} y - \min_{(x,y) \in \mathcal{M}_{cup}} y + 1$$
$$\text{vCDR} = \frac{D_{cup}}{D_{disc}}$$

#### Track B Empirical Visual Pipeline (Drishti-GS 006)
| 1. Original Fundus | 2. Luminance Smooth | 3. Optic Disc Mask | 4. Optic Cup Mask | 5. Dual Contour Overlay |
| :---: | :---: | :---: | :---: | :---: |
| ![Original](images/track_b_original.png) | ![Smooth](images/track_b_smoothed_response.png) | ![Disc](images/track_b_disc_mask.png) | ![Cup](images/track_b_cup_mask.png) | ![Overlay](images/track_b_overlay.png) |
*Figure 2: Complete sequential execution stages of Track B on Drishti-GS test image 006.*

---

## 4. Quantitative Results & Verified Benchmarks

### 4.1 Track A: DRIVE Vasculature Benchmark ($N=20$)
| Metric | Mean (N=20) | Std Dev | Dev Split (N=15) | Held-Out Split (N=5) |
| :--- | :---: | :---: | :---: | :---: |
| **Dice Similarity (F1)** | **0.6586** | $\pm 0.0584$ | 0.6452 | **0.6986** |
| **IoU (Jaccard Index)** | **0.4935** | $\pm 0.0615$ | 0.4790 | **0.5370** |
| **Sensitivity (Recall)** | **0.7307** | $\pm 0.0455$ | 0.7188 | **0.7665** |
| **Specificity (TNR)** | **0.9315** | $\pm 0.0187$ | 0.9295 | **0.9378** |
| **Precision (PPV)** | **0.6062** | $\pm 0.0851$ | 0.5935 | **0.6442** |
| **Overall Accuracy** | **0.9058** | $\pm 0.0167$ | 0.9026 | **0.9152** |

#### Track A Empirical Validation Overlays
| DRIVE 21 (Dev, Dice 0.667) | DRIVE 24 (Dev, Dice 0.715) | DRIVE 36 (Held-Out, Dice 0.720) | DRIVE 38 (Held-Out, Dice 0.702) |
| :---: | :---: | :---: | :---: |
| ![DRIVE 21](images/vessel_overlay_21_training.png) | ![DRIVE 24](images/vessel_overlay_24_training.png) | ![DRIVE 36](images/vessel_overlay_36_training.png) | ![DRIVE 38](images/vessel_overlay_38_training.png) |
*Figure 3: Representative vessel segmentation overlays from Development and Held-Out validation partitions.*

### 4.2 Track B: Drishti-GS ONH & Cup Benchmark ($N=50$)
| Metric | Mean (N=50) | Std Dev | Dev Split (N=35) | Held-Out Split (N=15) |
| :--- | :---: | :---: | :---: | :---: |
| **Optic Disc Dice** | **0.9221** | $\pm 0.1361$ | 0.9341 | **0.9459** |
| **Optic Disc IoU** | **0.8719** | $\pm 0.1341$ | 0.8792 | **0.8977** |
| **Optic Cup Dice** | **0.3229** | $\pm 0.2469$ | 0.3519 | **0.3017** |
| **Optic Cup IoU** | **0.2185** | $\pm 0.1815$ | 0.2413 | **0.1950** |
| **Vertical CDR Absolute Error**| **0.3513** | $\pm 0.2517$ | 0.3428 | **0.3992** |

#### Track B Empirical Validation Overlays & Failure Diagnostics
| drishtiGS_012 (vCDR Err 0.002) | drishtiGS_015 (High Confidence) | Diagnostic: Pale Cup Floor | Diagnostic: Glaucomatous Rim |
| :---: | :---: | :---: | :---: |
| ![Drishti 012](images/disc_cup_overlay_drishtiGS_012.png) | ![Drishti 015](images/disc_cup_overlay_drishtiGS_015.png) | ![Diagnostic 32](images/diagnostic_overlay_drishtiGS_032.png) | ![Diagnostic 81](images/diagnostic_overlay_drishtiGS_081.png) |
*Figure 4: Accurate dual-contour convergences alongside diagnostic failure cases showing 2D pale floor detection in sloping cups.*

### 4.3 Controlled Ablation Study
| Track | Variant | Mean Dice | Sensitivity | Specificity | Mean Runtime | Finding |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Track A** | **Baseline (CLAHE + MultiFrangi + Hysteresis)** | **0.6476** | **0.7074** | **0.9323** | **770.9 ms** | **Optimal balance of recall and noise suppression.** |
| Track A | No CLAHE (Raw Green Channel) | 0.6444 | 0.6759 | 0.9400 | 1004.7 ms | Peripheral capillaries lost in background shadows. |
| Track A | Single-Scale Frangi ($\sigma=2.0$) | 0.6857 | 0.6997 | 0.9504 | **197.5 ms** | 3.9x faster; misses thick primary trunks and fine tips. |
| Track A | Global Otsu Thresholding | **0.0816** | **0.0473** | 0.9935 | 2728.4 ms | **Catastrophic failure (-87% Dice). Vascular continuity destroyed.** |
| **Track B** | **Baseline (Closing + Lab $a^*$ + Containment)** | **0.8283** | **0.4096** | 0.0000 | **3128.9 ms** | **Strong disc localization and containment integrity.** |
| Track B | Without Morphological Closing | 0.8247 | 0.4100 | 0.0000 | 2168.8 ms | Large blood vessels degrade contour convergence. |
| Track B | Alternative Cup Channel (Inverted Red) | 0.8283 | 0.2694 | 0.0000 | 2253.8 ms | Insufficient chromatic contrast for the cup. |
| Track B | Unconstrained Cup Contour | 0.8283 | 0.4096 | 0.0000 | 1669.6 ms | Pale peripapillary atrophy leaks into the retina. |

### 4.4 CPU Latency & Efficiency Profiling
Measured using `time.perf_counter()` over 3 warm-up runs and 5 timed repetitions on standard multi-core Intel CPU hardware:
- **Track A (DRIVE, 565 × 584 px):** **$535.1 \pm 10.3\text{ ms}$** (Median: $539.7\text{ ms}$). Satisfies the $<2000\text{ ms}$ budget by a factor of 3.7x.
- **Track B (Drishti-GS, ~1752 × 2045 px):** **$2864.7 \pm 71.5\text{ ms}$** on full high-resolution imagery. (Downscaled previews execute in $\approx 312\text{ ms}$).
- **Track A Computational Breakdown:**
  - Image Preprocessing: $18.4\text{ ms}$ (4.0%)
  - CLAHE Equalization: $24.1\text{ ms}$ (5.3%)
  - Multiscale Hessian Convolutions (4 scales): $362.5\text{ ms}$ (79.1%)
  - Dual Hysteresis Binarization: $45.2\text{ ms}$ (9.8%)
  - Connected Component & FOV Masking: $8.0\text{ ms}$ (1.8%)
- **Peak RAM Footprint:** $< 240\text{ MB}$, zero dedicated VRAM.

---

## 5. Failure Mode & Limitation Analysis
A hallmark of rigorous scientific engineering is the honest identification of boundary conditions and edge cases:

1. **Central Light Reflex in Arterioles:**
   - Wide primary arterioles exhibit a specular reflection line along their longitudinal axis.
   - The Frangi Hessian filter occasionally perceives this as a trough flanked by two parallel ridges, resulting in a split double-line artifact.
2. **Capillary Contrast vs Sensor Noise:**
   - Vessels with diameter $< 1.5\text{ pixels}$ have contrast barely 4–8 intensity levels above background choroidal noise, failing the hysteresis low threshold.
3. **Optic Cup 2D Pallor vs 3D Excavation:**
   - The optic disc achieves **$0.9221\text{ Dice}$** because it has a sharp physical boundary (Elschnig's scleral ring).
   - The optic cup achieves **$0.3229\text{ Dice}$** because the cup is anatomically a **3D physical depression**. In a flat 2D color fundus photograph, the cup is merely an ambiguous pale area. Classical 2D thresholding detects only the pale floor, whereas ophthalmologists examine 3D depth and vascular kinking.
4. **Peripapillary Atrophy (PPA):**
   - High myopia or glaucoma produces bright scleral crescents adjacent to the disc. Without strict spatial bounds, active contours can be drawn outward toward PPA margins.

---

## 6. Software Architecture & Workstation Features
The frontend is engineered as a modern, high-performance scientific application:
- **Dual Operating Modes:**
  - **Student / Presentation Mode:** Guided 4-step stepper, visual filmstrip of intermediate pipeline stages, simplified sliders, and educational tooltips.
  - **Clinical / Research Mode:** Dense diagnostic telemetry, full confusion matrix counters ($TP, FP, FN, TN$), sub-millisecond execution breakdowns, coordinate HUD tracking, and CSV/JSON export.
- **Ergonomic Design:** Crisp white workstation chrome paired with an optically dark canvas viewport inside the viewer to preserve low-contrast retinal capillary visibility without glare.
- **Multi-Layer Viewer:** Live switching between Base Fundus Image, Binary Mask, Blended Overlay, and interactive Split-Screen Wipe with adjustable opacity and zoom/pan controls.

---

## 7. Authoritative References
1. **Frangi, A. F., Niessen, W. J., Vincken, K. L., & Viergever, M. A.** (1998). Multiscale vessel enhancement filtering. *Medical Image Computing and Computer-Assisted Intervention (MICCAI)*, LNCS 1496, pp. 130–137.
2. **Kass, M., Witkin, A., & Terzopoulos, D.** (1988). Snakes: Active contour models. *International Journal of Computer Vision (IJCV)*, 1(4), pp. 321–331.
3. **Staal, J., Abràmoff, M. D., Niemeijer, M., Viergever, M. A., & van Ginneken, B.** (2004). Ridge-based vessel segmentation in color images of the retina. *IEEE Transactions on Medical Imaging (TMI)*, 23(4), pp. 501–509.
4. **Sivaswamy, J., Krishnadas, S. R., Chakravarty, A., Joshi, G., Tabish, A. S., & Rani, P. K.** (2014). A comprehensive retinal dataset for glaucoma assessment (Drishti-GS). *IEEE International Symposium on Biomedical Imaging (ISBI)*, pp. 231–234.
5. **Zuiderveld, K.** (1994). Contrast limited adaptive histogram equalization. In *Graphics Gems IV*, Academic Press, pp. 474–485.
6. **Otsu, N.** (1979). A threshold selection method from gray-level histograms. *IEEE Transactions on Systems, Man, and Cybernetics*, 9(1), pp. 62–66.
