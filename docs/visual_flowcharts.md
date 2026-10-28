# OptiFilter / MorphoVision — Complete Visual System Flowchart

This document provides visual flowcharts mapping the architecture, end-to-end dataflow, and algorithms of **OptiFilter (MorphoVision)**: a deterministic, classical Digital Image Processing (DIP) retinal fundus analysis workstation.

---

## 1. High-Level System Architecture & Flow

```mermaid
flowchart TB
    %% Styling
    classDef client fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef api fill:#0f172a,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef engine fill:#1e1e38,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef data fill:#27272a,stroke:#fbbf24,stroke-width:2px,color:#f8fafc;

    subgraph Presentation_Layer ["1. Presentation Layer (Vite + React + Tailwind + Canvas)"]
        UI_Dash["Dashboard / Workspace"]:::client
        UI_TrackA["Track A: Vessel Analysis Page<br/>(Live Overlay & Metric Cards)"]:::client
        UI_TrackB["Track B: Disc & Cup Page<br/>(vCDR Gauge & Morphometry)"]:::client
        UI_Bench["Benchmark & Ablation Lab<br/>(DRIVE / Drishti-GS Testbed)"]:::client
        UI_Viewer["Interactive Pan / Zoom Canvas<br/>(RGB & Coordinate Inspector)"]:::client
    end

    subgraph Service_Layer ["2. REST Service Layer (FastAPI Backend)"]
        API_Gateway["FastAPI App (app/main.py)"]:::api
        R_Vessel["/api/vessels/segment"]:::api
        R_DiscCup["/api/disc-cup/segment"]:::api
        R_Bench["/api/benchmarks/run & /ablation"]:::api
        R_Datasets["/api/datasets (DRIVE, Drishti-GS, Demo)"]:::api
    end

    subgraph DIP_Core ["3. Deterministic Scientific DIP Core (Pure CPU, Zero ML)"]
        FOV_Engine["FOV Estimation & Mask Generator"]:::engine
        TrackA_Engine["Track A: Multiscale Frangi Vessel Engine"]:::engine
        TrackB_Engine["Track B: Active Contour Disc & CIELAB Cup Engine"]:::engine
        Metrics_Engine["FOV-Constrained Evaluation Engine<br/>(Dice, IoU, Sens, Spec, vCDR, Runtime)"]:::engine
    end

    subgraph Persistence ["4. Storage & Benchmarking Data"]
        DB[(Embedded SQLite DB<br/>app/db/)]:::data
        Datasets[(Local Datasets<br/>DRIVE / Drishti-GS / Demo)]:::data
    end

    %% Connections
    Presentation_Layer <-->|JSON REST & Base64 PNGs| Service_Layer
    API_Gateway --> R_Vessel & R_DiscCup & R_Bench & R_Datasets
    R_Vessel --> FOV_Engine & TrackA_Engine
    R_DiscCup --> FOV_Engine & TrackB_Engine
    R_Bench --> Metrics_Engine
    Metrics_Engine --> TrackA_Engine & TrackB_Engine
    R_Datasets --> Datasets
    R_Bench <--> DB
```

---

## 2. End-to-End Operational Execution Flow

```mermaid
flowchart TD
    Start([User Uploads / Selects Fundus Image]):::startClass --> Ingest[Decode Image to RGB NumPy Array]
    
    Ingest --> FOV[Compute FOV Mask & Non-Illuminated Border Exclusion]
    
    FOV --> Decision{Selected Task}
    
    Decision -->|Track A| PipelineA[Execute Vasculature Segmentation Pipeline]
    Decision -->|Track B| PipelineB[Execute Optic Disc / Cup & vCDR Pipeline]
    Decision -->|Full Analysis| Both[Execute Track A + Track B Concurrently]
    
    Both --> PipelineA
    Both --> PipelineB
    
    PipelineA --> MetricA[Calculate Vessel Density & Geometric Mask]
    PipelineB --> MetricB[Calculate Disc/Cup Dimensions & vCDR Ratio]
    
    MetricA & MetricB --> EvalCheck{Ground Truth Available?}
    
    EvalCheck -->|Yes: Benchmark Mode| CompareGT[Calculate Masked Dice, IoU, Sensitivity, Specificity, Precision, Accuracy]
    EvalCheck -->|No: Clinical Workstation Mode| PackageResult[Package Overlays, Histograms, and Morphometrics]
    
    CompareGT --> PackageResult
    PackageResult --> JSON[Return JSON Response with Base64 Overlays & Execution Latency]
    JSON --> Finish([Interactive Visualization in UI Viewer]):::endClass

    classDef startClass fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef endClass fill:#059669,stroke:#34d399,stroke-width:2px,color:#fff;
```

---

## 3. Track A Deep Dive: Retinal Vessel Segmentation

```mermaid
flowchart TD
    %% Styling
    classDef proc fill:#1e1e38,stroke:#818cf8,stroke-width:1.5px,color:#fff;
    classDef filter fill:#14532d,stroke:#22c55e,stroke-width:1.5px,color:#fff;
    classDef math fill:#581c87,stroke:#a855f7,stroke-width:1.5px,color:#fff;
    classDef output fill:#701a75,stroke:#f472b6,stroke-width:2px,color:#fff;

    RGB[RGB Fundus Input]:::proc --> Split[Color Channel Decomposition]
    Split --> Green["Isolate Green Channel (540–570 nm)<br/><i>Optimal hemoglobin absorption contrast</i>"]:::filter
    
    Green --> CLAHE["CLAHE Contrast Enhancement<br/>(clip_limit=2.0, tile_grid=8x8)"]:::filter
    CLAHE --> MedFilter["Median / Gaussian Denoising<br/>(Suppresses sensor noise & speckle)"]:::filter
    
    MedFilter --> Hessian["Compute 2D Hessian Matrix across Scales<br/>σ ∈ {1.0, 1.5, 2.0, 3.0, 4.0}"]:::math
    
    subgraph Frangi_Step ["Frangi Vesselness Response Calculation"]
        Hessian --> Eig["Eigenvalues: |λ1| ≤ |λ2|"]:::math
        Eig --> Blobness["Blobness Measure: Rb = |λ1| / |λ2|"]:::math
        Eig --> Structure["Second Order Structureness: S = √(λ1² + λ2²)"]:::math
        Blobness & Structure --> Resp["V0(s) = exp(-Rb² / 2β²) · (1 - exp(-S² / 2c²)) if λ2 < 0 else 0"]:::math
    end
    
    Resp --> MaxScale["Multiscale Maximum Projection<br/>V(x,y) = max_σ V_σ(x,y)"]:::proc
    
    MaxScale --> Hyst["Dynamic Percentile Hysteresis Thresholding<br/>(T_high = 92nd percentile, T_low = 75th percentile)"]:::proc
    
    Hyst --> ConnComp["Connected Component Morphology<br/>(Prune isolated islands < min_size=15 px)"]:::proc
    
    ConnComp --> FOV_AND["Apply FOV Mask (Bitwise AND)<br/><i>Eliminates false positives at fundus rim</i>"]:::proc
    
    FOV_AND --> FinalVessel["Final Binary Vessel Mask & Overlay Canvas"]:::output
```

---

## 4. Track B Deep Dive: Optic Disc & Cup Segmentation (vCDR)

```mermaid
flowchart TD
    %% Styling
    classDef proc fill:#1e1e38,stroke:#818cf8,stroke-width:1.5px,color:#fff;
    classDef disc fill:#1e3a5f,stroke:#38bdf8,stroke-width:1.5px,color:#fff;
    classDef cup fill:#701a75,stroke:#f472b6,stroke-width:1.5px,color:#fff;
    classDef enforce fill:#7f1d1d,stroke:#ef4444,stroke-width:2px,color:#fff;
    classDef metric fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff;

    RGB_In[RGB Fundus Input]:::proc --> Fork[Color Space Divergence]
    
    %% Disc Branch
    Fork --> Red["Red Channel Extraction<br/><i>Maximum sclera & ONH reflectance</i>"]:::disc
    Red --> MorphClose["Morphological Closing (Ball SE, r=15)<br/><i>Eliminates obscuring blood vessels</i>"]:::disc
    MorphClose --> GaussSmooth["Gaussian Luminance Smoothing (σ=5.0)"]:::disc
    GaussSmooth --> Peak["Argmax Centroid Localization<br/>(Initializes ROI Box: 200x200 px)"]:::disc
    Peak --> SnakeInit["Initialize Morphological / Active Contour Snake"]:::disc
    SnakeInit --> SnakeEvolve["Evolve Contour to Disc Margin<br/>(Minimizing Edge Energy & Gradient Vector Flow)"]:::disc
    SnakeEvolve --> DiscMask["Candidate Optic Disc Mask (M_disc)"]:::disc
    
    %% Cup Branch
    Fork --> Lab["Convert to CIELAB Color Space"]:::cup
    Lab --> A_Star["Extract a* Chromatic Channel (Green-Red Axis)"]:::cup
    A_Star --> InvertA["Invert Feature: F_cup = 255 - a*<br/><i>Cup excavation stands out as pale plateau</i>"]:::cup
    InvertA --> MaskedOtsu["Otsu Adaptive Thresholding within Disc ROI"]:::cup
    MaskedOtsu --> CupCand["Raw Candidate Cup Mask (M_cand_cup)"]:::cup
    
    %% Strict Containment Rule
    DiscMask & CupCand --> Containment["Strict Anatomical Containment Rule<br/><b>M_cup = M_cand_cup ∩ M_disc</b><br/><i>Physiologically guarantees M_cup ⊆ M_disc (100% invariant)</i>"]:::enforce
    
    Containment --> FinalCup["Validated Optic Cup Mask (M_cup)"]:::cup
    
    %% vCDR Calculation
    DiscMask --> VSpanDisc["Vertical Disc Diameter:<br/>D_disc = max(y) - min(y) + 1"]:::metric
    FinalCup --> VSpanCup["Vertical Cup Diameter:<br/>D_cup = max(y) - min(y) + 1"]:::metric
    
    VSpanDisc & VSpanCup --> vCDR["Calculate Vertical Cup-to-Disc Ratio<br/><b>vCDR = D_cup / D_disc</b>"]:::metric
    
    vCDR --> Glaucoma["Glaucoma Risk Stratification Indicator<br/>(Normal: vCDR ≤ 0.5 | Borderline: 0.5–0.65 | Elevated: > 0.65)"]:::metric
```

---

## 5. Benchmarking & Ablation Engine Flowchart

```mermaid
flowchart LR
    subgraph Inputs
        DS[Dataset: DRIVE or Drishti-GS]
        SplitSel[Split: Dev or Held-Out Test]
        Params[Hyperparameter Overrides]
    end

    subgraph Batch_Runner ["Evaluation Loop (runner.py)"]
        Iter[Iterate Dataset Samples]
        TimerStart[Start High-Res Timer: perf_counter]
        RunPipe[Execute Selected DIP Track]
        TimerEnd[Record Sub-2s CPU Latency]
        
        Compare[Compute FOV-Masked Metrics vs Expert Annotations:
        - Dice Coefficient / F1 Score
        - IoU / Jaccard Index
        - Sensitivity & Specificity
        - vCDR Absolute Error]
    end

    subgraph Aggregator ["Statistical Aggregation"]
        MeanStd[Calculate Mean ± Std Dev]
        TableGen[Generate Markdown & LaTeX Tables]
        Export[Save JSON Logs & CSV Benchmarks]
    end

    Inputs --> Batch_Runner
    TimerStart --> RunPipe --> TimerEnd --> Compare
    Iter --> TimerStart
    Compare --> Aggregator
```

---

## 6. Key Algorithmic Formulations Summary

| Stage | Mathematical Basis | Primary Operational Role |
| :--- | :--- | :--- |
| **FOV Extraction** | $I_{gray} > \theta_{fov} \rightarrow \mathcal{M}_{fov}$ | Excludes black boundary from skewing specificity & accuracy |
| **Vasculature Contrast** | $\text{CLAHE}(I_G, \text{clip}=2.0, \text{grid}=(8,8))$ | Enhances microcapillaries against retinal pigment variation |
| **Frangi Eigenanalysis** | $\mathcal{H} = \begin{bmatrix} I_{xx} & I_{xy} \\ I_{yx} & I_{yy} \end{bmatrix}, \lambda_1, \lambda_2$ | Discriminates tubular vessels from non-tubular exudates/lesions |
| **Disc Localization** | $R_{close} = (I_R \bullet B)_{r=15}$, $(x_0, y_0) = \arg\max(G_\sigma * R_{close})$ | Robust optic nerve head centroid detection unaffected by vessel trunks |
| **Cup Extraction** | $F_{cup} = 255 - a^*$, $\mathcal{M}_{cand\_cup} = \text{Otsu}(F_{cup})$ | Exploits physiological absence of blood vessels in physiological cup |
| **Strict Containment** | $\mathcal{M}_{cup} = \mathcal{M}_{cand\_cup} \cap \mathcal{M}_{disc}$ | Prevents cup leakage into peripapillary atrophy (PPA) regions |
| **Vertical CDR** | $\text{vCDR} = \frac{\max_{cup} y - \min_{cup} y + 1}{\max_{disc} y - \min_{disc} y + 1}$ | Standard quantitative ophthalmic biomarker for cup enlargement |
