# OptiFilter / MorphoVision — Classical DIP Methodology

**Project Title:** Lightweight Classical Digital Image Processing for Retinal Vessel and Optic Disc/Cup Segmentation  
**Author / Research Team:** DIP Systems & Scientific Imaging Laboratory  

---

## 1. Mathematical Framework

OptiFilter addresses two fundamental diagnostic visualization problems in retinal fundus image processing using deterministic classical computer vision, requiring zero neural networks or learned weights:
1. **Track A:** Segmentation of the retinal vascular tree.
2. **Track B:** Segmentation of the optic disc and optic cup, and calculation of the vertical Cup-to-Disc Ratio ($vCDR$).

### 1.1 Field-of-View (FOV) Geometry & Preprocessing

Retinal fundus images are captured through circular optical apertures. Peripheral margins outside the illuminated retina contain sensor noise and dark vignetting that induce severe gradient spikes.
When official ground-truth FOV masks are unavailable, OptiFilter estimates the FOV mask $\mathcal{M}_{FOV}$ via intensity thresholding and morphological closing:

$$\mathcal{M}_{0}(x, y) = \mathbb{I}\left( \max(R, G, B) > \tau_{FOV} \right)$$

$$\mathcal{M}_{FOV} = \mathcal{M}_{0} \bullet \mathcal{B}_{r_{FOV}}$$

where $\mathcal{B}_{r_{FOV}}$ is a flat circular structuring element with radius $r_{FOV} \approx 0.015 \cdot \min(H, W)$. All subsequent metrics, percentiles, and normalizations are computed strictly over the domain $\Omega_{FOV} = \{ (x, y) \mid \mathcal{M}_{FOV}(x, y) = 1 \}$.

---

## 2. Track A: Retinal Vessel Segmentation

### 2.1 Optical Contrast & Local Equalization
In fundus imaging, oxygenated and deoxygenated hemoglobin exhibits peak light absorption in the green spectrum ($\approx 540\text{--}570\text{ nm}$), whereas melanin in the retinal pigment epithelium reflects red light. The green channel $I_G$ yields maximum vessel-to-background contrast.

To counter non-uniform illumination and macular dark shading, Contrast Limited Adaptive Histogram Equalization (CLAHE) is applied:
- Grid size: $8 \times 8$ tiles
- Clip limit: $\beta = 2.0$

### 2.2 Multiscale Hessian Eigenanalysis (Frangi Vesselness)
At scale $\sigma$, the Hessian matrix of Gaussian-convolved intensity $I(x, y)$ is:

$$\mathcal{H}_\sigma = \begin{bmatrix} \frac{\partial^2 (G_\sigma * I)}{\partial x^2} & \frac{\partial^2 (G_\sigma * I)}{\partial x \partial y} \\ \frac{\partial^2 (G_\sigma * I)}{\partial y \partial x} & \frac{\partial^2 (G_\sigma * I)}{\partial y^2} \end{bmatrix}$$

Let ordered eigenvalues be $|\lambda_1| \le |\lambda_2|$. For dark tubular structures on a brighter background:
- Blobness ratio: $R_B = |\lambda_1| / |\lambda_2|$
- Second-order structure: $\mathcal{S} = \sqrt{\lambda_1^2 + \lambda_2^2}$

$$V_\sigma(x, y) = \begin{cases} 0 & \text{if } \lambda_2 > 0 \\ \exp\left(-\frac{R_B^2}{2\beta^2}\right) \left[1 - \exp\left(-\frac{\mathcal{S}^2}{2c^2}\right)\right] & \text{if } \lambda_2 \le 0 \end{cases}$$

Scales $\sigma \in \{1.0, 1.5, 2.0, 3.0, 4.0\}\text{ px}$ capture both primary vascular arcades and fine micro-vessels. The unified vesselness response is obtained via maximum scale projection:

$$\mathcal{V}(x, y) = \max_{\sigma} V_\sigma(x, y), \quad (x, y) \in \Omega_{FOV}$$

### 2.3 Dual-Threshold Hysteresis Binarization
Instead of a single global cutoff (e.g. Otsu) which fragments thin vessels, dual hysteresis thresholding uses:
- High threshold $\tau_H$: 92nd percentile of $\mathcal{V}$ in $\Omega_{FOV}$ (seeds confident vessel cores).
- Low threshold $\tau_L$: 75th percentile of $\mathcal{V}$ in $\Omega_{FOV}$ (retains continuous vascular branches).

Connected components with area $< 25\text{ px}$ are pruned to suppress isolated noise.

---

## 3. Track B: Optic Disc & Cup Segmentation

### 3.1 Disc Localization
The optic nerve head represents the optical outlet for retinal nerve fibers and central retinal vessels, characterized by high reflectance in the red channel ($I_R$).
To eliminate dark blood vessels that traverse and fragment the disc:
1. Adaptive morphological closing: disk radius $r_{close} = \lfloor 0.025 \cdot \min(H, W) \rfloor$.
2. Isotropic Gaussian smoothing: $\sigma = 0.020 \cdot \min(H, W)$.
3. Centroid localization: Candidate point $(\hat{x}_c, \hat{y}_c) = \arg\max_{(x, y) \in \Omega_{FOV}^\circ} I_{smooth}(x, y)$ where $\Omega_{FOV}^\circ$ is an eroded interior domain avoiding border illumination artifacts.

### 3.2 Active Contour (Snake) Optimization
From an initial circular contour centered at $(\hat{x}_c, \hat{y}_c)$ with radius $R_{init} \approx 0.08 \cdot \min(H, W)$, the contour curve $v(s)$ deforms to minimize:

$$E_{snake} = \int_0^1 \left[ \frac{\alpha}{2} \left|\frac{dv}{ds}\right|^2 + \frac{\beta}{2} \left|\frac{d^2v}{ds^2}\right|^2 - |\nabla (G_\sigma * I(v(s)))|^2 \right] ds$$

with continuity weight $\alpha = 0.015$ and curvature weight $\beta = 0.1$. The resulting closed polygon yields the binary disc mask $\mathcal{M}_{disc}$.

### 3.3 Constrained Optic Cup Segmentation
The optic cup is the pale central physiological excavation devoid of neuroretinal tissue. In the CIELAB color space, the $a^*$ channel represents the green-red chromatic axis: the pale cup has significantly lower $a^*$ (less pink/red).
Using the feature $F_{cup} = 255 - a^*$, Otsu thresholding on the upper half of $F_{cup}$ within $\mathcal{M}_{disc}$ separates the cup.
Crucially, **the strict containment constraint is enforced**:

$$\mathcal{M}_{cup} = \mathcal{M}_{cand\_cup} \cap \mathcal{M}_{disc}$$

This ensures that the cup mask cannot leak outside the optic disc boundary under any circumstances.

### 3.4 Morphometric Biomarker Extraction
Vertical diameters are measured along the vertical axis of the binary masks:

$$D_d = \max_{(x, y) \in \mathcal{M}_{disc}} y - \min_{(x, y) \in \mathcal{M}_{disc}} y + 1$$

$$D_c = \max_{(x, y) \in \mathcal{M}_{cup}} y - \min_{(x, y) \in \mathcal{M}_{cup}} y + 1$$

$$\text{vCDR} = \frac{D_c}{D_d}$$

If $\mathcal{M}_{disc}$ is degenerate ($D_d \le 0$), the pipeline flags a structured failure rather than returning a synthetic value.
