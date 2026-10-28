import React from 'react';
import {
  BookOpen,
  Code2,
  Database,
  AlertTriangle,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export const DocumentationPage: React.FC = () => {
  return (
    <div className="max-w-[1780px] mx-auto px-3 sm:px-6 py-5 space-y-6">
      {/* Title Header */}
      <div className="pb-2 border-b border-[#E2E8F0]">
        <h2 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
          <span>OptiFilter / MorphoVision — Scientific Methodology &amp; Engineering Manual</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-[#10B981]/15 text-[#059669] border border-[#10B981]/30">
            Academic Reference
          </span>
        </h2>
        <p className="text-xs text-[#64748B] mt-1">
          Mathematical formulations, parameter definitions, dataset placement guidelines, CPU benchmarking protocol, and classical DIP boundaries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Outline / TOC (1 col) */}
        <div className="md:col-span-1 space-y-2">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-2 sticky top-20 shadow-xs">
            <span className="font-semibold text-[#0F172A] block pb-1.5 border-b border-[#E2E8F0]">
              Documentation Sections
            </span>
            <a href="#pipeline-math" className="block text-[#64748B] hover:text-[#059669] py-1 transition-colors">
              1. Mathematical Formulations
            </a>
            <a href="#vessel-pipeline" className="block text-[#64748B] hover:text-[#059669] py-1 transition-colors">
              2. Track A: Vessel Pipeline
            </a>
            <a href="#disc-cup-pipeline" className="block text-[#64748B] hover:text-[#059669] py-1 transition-colors">
              3. Track B: Disc &amp; Cup Pipeline
            </a>
            <a href="#metrics" className="block text-[#64748B] hover:text-[#059669] py-1 transition-colors">
              4. Quantitative Metrics &amp; FOV
            </a>
            <a href="#datasets" className="block text-[#64748B] hover:text-[#059669] py-1 transition-colors">
              5. Dataset Acquisition Guide
            </a>
            <a href="#limitations" className="block text-[#64748B] hover:text-[#059669] py-1 transition-colors">
              6. Failure Modes &amp; DIP Boundaries
            </a>
            <a href="#citation" className="block text-[#64748B] hover:text-[#059669] py-1 transition-colors">
              7. Citation &amp; Reproducibility
            </a>
          </div>
        </div>

        {/* Main Content (3 cols) */}
        <div className="md:col-span-3 space-y-6 text-xs text-[#0F172A] leading-relaxed">
          {/* Section 1: Mathematical Formulations */}
          <section id="pipeline-math" className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 pb-2.5 border-b border-[#E2E8F0]">
              <Code2 className="w-4 h-4 text-[#059669]" />
              <span>1. Mathematical Formulations</span>
            </h3>

            <div>
              <h4 className="font-semibold text-[#0F172A] mb-1">Multiscale Hessian Frangi Vesselness</h4>
              <p className="text-[#64748B] mb-2 leading-relaxed">
                At each spatial scale σ, the local second-order directional derivatives of the Gaussian-convolved image form the Hessian matrix:
              </p>
              <pre className="p-3.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] font-mono text-[11px] overflow-x-auto text-[#0284C7]">
{`H_σ(x, y) = [ I_xx(x, y, σ)   I_xy(x, y, σ) ]
            [ I_yx(x, y, σ)   I_yy(x, y, σ) ]`}
              </pre>
              <p className="text-[#64748B] mt-2.5 mb-2 leading-relaxed">
                With ordered eigenvalues |λ₁| ≤ |λ₂|, the 2D vesselness filter measures tubular morphology:
              </p>
              <pre className="p-3.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] font-mono text-[11px] overflow-x-auto text-[#059669]">
{`R_B = |λ₁| / |λ₂|   (blobness measure, zero for elongated vessels)
S = sqrt(λ₁² + λ₂²) (second-order structure / contrast measure)

V_σ(x, y) = 0                                       if λ₂ > 0 (for dark ridges)
V_σ(x, y) = exp(-R_B² / (2β²)) * (1 - exp(-S² / (2c²)))  otherwise`}
              </pre>
              <p className="text-[#64748B] text-[11px] mt-2">
                Overall vesselness response across all tested scales is calculated by maximum projection:
                <code className="font-mono bg-[#F8FAFC] px-1.5 py-0.5 rounded text-[#0F172A] ml-1 border border-[#E2E8F0]">V(x, y) = max_σ (V_σ(x, y))</code>.
              </p>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0]">
              <h4 className="font-semibold text-[#0F172A] mb-1">Active Contour Energy Minimization</h4>
              <p className="text-[#64748B] mb-2 leading-relaxed">
                The optic disc boundary v(s) = (x(s), y(s)) minimizes the classical snake energy functional:
              </p>
              <pre className="p-3.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] font-mono text-[11px] overflow-x-auto text-[#0284C7]">
{`E_snake = ∫ [ E_internal(v(s)) + E_external(v(s)) ] ds
E_internal = 0.5 * (α |v'(s)|² + β |v''(s)|²)
E_external = - |∇(G_σ * I(x, y))|²`}
              </pre>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0]">
              <h4 className="font-semibold text-[#0F172A] mb-1">Vertical Cup-to-Disc Ratio (vCDR)</h4>
              <p className="text-[#64748B] mb-1.5 leading-relaxed">
                Defined strictly as the ratio of maximum vertical extents along the vertical meridian:
              </p>
              <pre className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] font-mono text-[11px] text-[#059669]">
{`vCDR = (max(y_cup) - min(y_cup) + 1) / (max(y_disc) - min(y_disc) + 1)`}
              </pre>
            </div>
          </section>

          {/* Section 2 & 3: Track A and Track B Pipelines */}
          <section id="vessel-pipeline" className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 pb-2.5 border-b border-[#E2E8F0]">
              <Layers className="w-4 h-4 text-[#059669]" />
              <span>2. Track A: Retinal Vessel Segmentation Pipeline</span>
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-[#64748B] marker:font-mono marker:text-[#059669]">
              <li><strong className="text-[#0F172A]">Green Channel Extraction:</strong> Blood vessels absorb light in the 540–570 nm green band, yielding optimal optical contrast against the retina.</li>
              <li><strong className="text-[#0F172A]">Field of View (FOV) Masking:</strong> Dataset-provided mask or Otsu border thresholding prevents camera rim artifacts.</li>
              <li><strong className="text-[#0F172A]">CLAHE:</strong> Contrast Limited Adaptive Histogram Equalization with 8×8 grid and clip limit 2.0 amplifies thin micro-vessels without amplifying homogeneous noise.</li>
              <li><strong className="text-[#0F172A]">Multiscale Frangi Filtering:</strong> Sigmas [1.0, 1.5, 2.0, 3.0, 4.0] detect vessels of varying calibers. Polarity set to dark ridges.</li>
              <li><strong className="text-[#0F172A]">Dual Hysteresis Thresholding:</strong> 75th percentile (low) and 92nd percentile (high) preserve weak vascular branches connected to confident primary trunks.</li>
              <li><strong className="text-[#0F172A]">Connected Component Cleanup:</strong> Removes isolated noise artifacts &lt; 25 pixels.</li>
            </ol>
          </section>

          <section id="disc-cup-pipeline" className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 pb-2.5 border-b border-[#E2E8F0]">
              <Layers className="w-4 h-4 text-[#0284C7]" />
              <span>3. Track B: Optic Disc &amp; Cup Segmentation Pipeline</span>
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-[#64748B] marker:font-mono marker:text-[#0284C7]">
              <li><strong className="text-[#0F172A]">Luminance Centroid Localization:</strong> Red channel extraction + morphological closing (radius = 0.025 × min(H, W)) bridges traversing vessels, followed by Gaussian smoothing (σ = 0.02 × min(H, W)).</li>
              <li><strong className="text-[#0F172A]">Active Contour Fitting:</strong> Circular initial snake placed at estimated center converges onto the neuroretinal rim boundary.</li>
              <li><strong className="text-[#0F172A]">Cup Localization:</strong> CIELAB 255 - a* paleness channel analyzed strictly inside the predicted disc ROI.</li>
              <li><strong className="text-[#0F172A]">Strict Containment Enforcement:</strong> Cup mask is intersected with disc mask (<code className="font-mono text-[#0F172A] bg-[#F8FAFC] px-1 py-0.5 rounded border border-[#E2E8F0]">cup = cup &amp; disc</code>) guaranteeing anatomical validity.</li>
              <li><strong className="text-[#0F172A]">Vertical CDR Calculation:</strong> Computes vertical span of disc and cup and validates physiological plausibility.</li>
            </ol>
          </section>

          {/* Section 4: Metrics */}
          <section id="metrics" className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 pb-2.5 border-b border-[#E2E8F0]">
              <ShieldCheck className="w-4 h-4 text-[#059669]" />
              <span>4. Quantitative Metrics &amp; FOV Masking</span>
            </h3>
            <p className="text-[#64748B] leading-relaxed">
              All metric calculations evaluate pixels strictly inside the valid FOV. Formulas include safe zero-division handling:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-[11px]">
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#0F172A]">Dice Coefficient (F1):</strong>
                <p className="text-[#059669] font-bold mt-0.5">2·TP / (2·TP + FP + FN)</p>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#0F172A]">IoU (Jaccard Index):</strong>
                <p className="text-[#059669] font-bold mt-0.5">TP / (TP + FP + FN)</p>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#0F172A]">Sensitivity (Recall):</strong>
                <p className="text-[#059669] font-bold mt-0.5">TP / (TP + FN)</p>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#0F172A]">Specificity (TNR):</strong>
                <p className="text-[#059669] font-bold mt-0.5">TN / (TN + FP)</p>
              </div>
            </div>
          </section>

          {/* Section 5: Datasets */}
          <section id="datasets" className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 pb-2.5 border-b border-[#E2E8F0]">
              <Database className="w-4 h-4 text-[#059669]" />
              <span>5. Dataset Acquisition &amp; Placement</span>
            </h3>
            <p className="text-[#64748B] leading-relaxed">
              To benchmark with external public datasets, place them in the following paths under <code className="font-mono bg-[#F8FAFC] px-1.5 py-0.5 rounded text-[#0F172A] border border-[#E2E8F0]">backend/data/datasets/</code>:
            </p>
            <pre className="p-3.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] font-mono text-[11px] overflow-x-auto text-[#475569]">
{`backend/data/datasets/
├── DRIVE/
│   ├── training/
│   │   ├── images/       (*_training.tif)
│   │   ├── 1st_manual/   (*_manual1.gif)
│   │   └── mask/         (*_training_mask.gif)
│   └── test/
│       ├── images/       (*_test.tif)
│       └── mask/         (*_test_mask.gif)
└── Drishti-GS/
    ├── Drishti-GS_training/
    │   ├── Images/       (*.png)
    │   └── GT/           (softMap annotations)
    └── Drishti-GS_test/
        ├── Images/
        └── GT/`}
            </pre>
            <p className="text-[11px] text-[#64748B]">
              Individual fundus photography scans can be directly uploaded and analyzed on demand across all scientific pages without pre-installing datasets.
            </p>
          </section>

          {/* Section 6: Limitations & DIP Boundaries */}
          <section id="limitations" className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 pb-2.5 border-b border-[#E2E8F0]">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>6. Failure Modes &amp; Classical DIP Boundaries</span>
            </h3>
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-2">
              <p className="leading-relaxed">
                <strong className="text-amber-950">Non-Diagnostic Research Notice:</strong> OptiFilter is a scientific image workstation for classical digital image processing. It does not provide medical diagnoses or replace clinical ophthalmic examinations.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] text-amber-900">
                <li><strong className="text-amber-950">Peripapillary Atrophy (PPA):</strong> Severe temporal atrophy can distort optic disc luminance boundaries, triggering morphological fallback priors.</li>
                <li><strong className="text-amber-950">Pathological Exudates:</strong> Bright diabetic retinopathy exudates can cause spurious local maxima during disc center peak localization.</li>
                <li><strong className="text-amber-950">Low-Contrast Thin Capillaries:</strong> Vessels &lt; 1 pixel wide in peripheral retinal zones may drop below hysteresis thresholds.</li>
              </ul>
            </div>
          </section>

          {/* Section 7: Citation */}
          <section id="citation" className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 pb-2.5 border-b border-[#E2E8F0]">
              <BookOpen className="w-4 h-4 text-[#059669]" />
              <span>7. Citation &amp; Methodology References</span>
            </h3>
            <pre className="p-3.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] font-mono text-[10px] text-[#475569] overflow-x-auto">
{`@article{frangi1998multiscale,
  title={Multiscale vessel enhancement filtering},
  author={Frangi, Alejandro F and Niessen, Wiro J and Vincken, Koen L and Viergever, Max A},
  journal={Medical Image Computing and Computer-Assisted Intervention—MICCAI’98},
  pages={130--137},
  year={1998},
  publisher={Springer}
}

@article{kass1988snakes,
  title={Snakes: Active contour models},
  author={Kass, Michael and Witkin, Andrew and Terzopoulos, Demetri},
  journal={International Journal of Computer Vision},
  volume={1},
  number={4},
  pages={321--331},
  year={1988}
}`}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
};
