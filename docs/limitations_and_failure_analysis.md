# OptiFilter / MorphoVision — Limitations & Failure Analysis

In rigorous scientific research, identifying boundary conditions, failure modes, and edge cases is as essential as reporting positive benchmarks. Below is a detailed failure analysis of classical Digital Image Processing (DIP) methods applied to retinal imaging.

---

## 1. Track A: Retinal Vessel Segmentation Failure Modes

### 1.1 Central Light Reflex in Arterioles
- **Symptom:** Wide primary retinal arterioles exhibit a bright specular reflection line along their central longitudinal axis.
- **Classical DIP Consequence:** The Frangi Hessian filter, designed for uniform dark ridges, occasionally perceives the reflex as a valley flanked by two parallel vessels, creating an artifactual split double-line.
- **Mitigation in OptiFilter:** Morphological closing and multiscale scale integration ($\sigma = 3.0, 4.0\text{ px}$) attenuate high-frequency longitudinal splits.

### 1.2 Fine Capillaries vs. Noise Thresholding
- **Symptom:** Vessels with calibers $< 1\text{ px}$ in peripheral zones have weak absorption signals.
- **Classical DIP Consequence:** If the hysteresis low threshold $\tau_L$ is lowered to capture fine capillaries, background choroidal tessellation noise increases false positives (lowering precision). If raised, peripheral capillary tips are pruned (lowering recall).
- **Benchmark Impact:** Sensitivity remains balanced around 0.70–0.78 without learned semantic priors.

### 1.3 Pathological Exudates and Hemorrhages
- **Symptom:** Diabetic retinopathy generates microaneurysms, blot hemorrhages, and cotton-wool spots.
- **Classical DIP Consequence:** Irregular dark dot hemorrhages may have non-zero Frangi response if elongated, causing false positives.

---

## 2. Track B: Optic Disc & Cup Segmentation Failure Modes

### 2.1 Peripapillary Atrophy (PPA)
- **Symptom:** High myopia or glaucomatous eyes frequently exhibit crescents of chorioretinal thinning and scleral exposure immediately adjacent to the temporal disc rim.
- **Classical DIP Consequence:** Because PPA has high reflectance similar to the disc, gradient-based active contours (snakes) can be drawn outward toward the outer PPA border rather than the anatomical scleral ring (Elschnig's ring).
- **Mitigation in OptiFilter:** Plausibility area ratio bounds ($\text{Area} / \text{FOV} \le 0.35$) and circular fallback geometry prevent contour expansion into the macula.

### 2.2 Cup-Disc Contrast Paucity
- **Symptom:** In shallow optic cups or early-stage glaucoma, the chromatic gradient between the neuroretinal rim and the cup excavation is subtle.
- **Classical DIP Consequence:** Thresholding within the disc region can become noisy or degenerate if the histogram lacks a distinct bimodal distribution.
- **Mitigation in OptiFilter:** OptiFilter monitors the candidate ratio and returns a structured advisory flag rather than fabricating an artificial contour.

---

## 3. Computational and Hardware Boundaries

- **CPU Efficiency Target:** OptiFilter targets $< 2,000\text{ ms}$ processing per image on commodity laptop CPUs.
- **Observed Performance:** On a standard multi-core CPU, the multiscale Frangi pipeline operates in $\approx 450\text{--}550\text{ ms}$ for $512\times 512$ images, and the active contour disc/cup pipeline operates in $\approx 250\text{--}350\text{ ms}$.
- **Resolution Scaling:** Images above $2000 \times 2000\text{ px}$ exhibit $\mathcal{O}(H \cdot W \cdot K)$ scaling with multiscale convolutions, suggesting spatial downsampling or multi-resolution pyramid processing for ultra-high-resolution acquisition systems.
