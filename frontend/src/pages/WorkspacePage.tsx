import React, { useState, useEffect } from 'react';
import {
  Upload,
  Play,
  RotateCw,
  FolderOpen,
  CheckCircle,
  AlertTriangle,
  FileText,
  Sliders,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { MetricsBadge } from '../components/MetricsBadge';
import { StageGallery } from '../components/StageGallery';
import { ExecutionTimer } from '../components/ExecutionTimer';
import {
  inspectImage,
  runVesselAnalysis,
  runDiscCupAnalysis,
  fetchDatasets,
} from '../services/api';
import {
  VesselAnalysisResult,
  DiscCupAnalysisResult,
  DatasetSummary,
} from '../types';

export const WorkspacePage: React.FC = () => {
  // Datasets & Sample Selection (Clean initial state - zero demo samples)
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Optional Reference Ground-Truth Masks for validation
  const [showGtUpload, setShowGtUpload] = useState(false);
  const [vesselGtFile, setVesselGtFile] = useState<File | null>(null);
  const [discGtFile, setDiscGtFile] = useState<File | null>(null);
  const [cupGtFile, setCupGtFile] = useState<File | null>(null);

  // Active track: 'vessels' or 'disc_cup'
  const [activeTrack, setActiveTrack] = useState<'vessels' | 'disc_cup'>('vessels');

  // Loading & Error States
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inspection Previews
  const [inspectionData, setInspectionData] = useState<any | null>(null);

  // Analysis Results
  const [vesselResult, setVesselResult] = useState<VesselAnalysisResult | null>(null);
  const [discCupResult, setDiscCupResult] = useState<DiscCupAnalysisResult | null>(null);

  // Current Active Image in Viewer
  const [activeStageKey, setActiveStageKey] = useState<string>('overlay');

  // Load available datasets on mount (only real installed datasets)
  useEffect(() => {
    fetchDatasets()
      .then((data) => {
        const installedDatasets = data.filter((d) => d.installed && d.total_images > 0);
        setDatasets(installedDatasets);
      })
      .catch((err) => console.error('Failed to load datasets', err));
  }, []);

  // When selection changes, trigger lightweight inspection ONLY if an image is provided
  useEffect(() => {
    if (uploadedFile || (selectedDataset && selectedItemId)) {
      handleInspect();
    } else {
      setInspectionData(null);
      setVesselResult(null);
      setDiscCupResult(null);
    }
  }, [selectedDataset, selectedItemId, uploadedFile]);

  const handleInspect = async () => {
    setErrorMessage(null);
    try {
      const formData = new FormData();
      if (uploadedFile) {
        formData.append('file', uploadedFile);
      } else if (selectedDataset && selectedItemId) {
        formData.append('dataset_name', selectedDataset);
        formData.append('item_id', selectedItemId);
      } else {
        return;
      }
      const data = await inspectImage(formData);
      setInspectionData(data);
      // Reset previous run results when new image is inspected
      setVesselResult(null);
      setDiscCupResult(null);
      setActiveStageKey('original');
    } catch (err: any) {
      setErrorMessage(err.message || 'Inspection failed');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
      setSelectedDataset('');
      setSelectedItemId('');
    }
  };

  const handleRunAnalysis = async () => {
    if (!uploadedFile && (!selectedDataset || !selectedItemId)) {
      setErrorMessage('Please upload a retinal fundus scan before starting analysis.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      if (uploadedFile) {
        formData.append('file', uploadedFile);
        if (activeTrack === 'vessels' && vesselGtFile) {
          formData.append('gt_file', vesselGtFile);
        } else if (activeTrack === 'disc_cup') {
          if (discGtFile) formData.append('gt_disc_file', discGtFile);
          if (cupGtFile) formData.append('gt_cup_file', cupGtFile);
        }
      } else {
        formData.append('dataset_name', selectedDataset);
        formData.append('item_id', selectedItemId);
      }

      if (activeTrack === 'vessels') {
        const res = await runVesselAnalysis(formData);
        setVesselResult(res);
        setActiveStageKey('overlay');
      } else {
        const res = await runDiscCupAnalysis(formData);
        setDiscCupResult(res);
        setActiveStageKey('overlay');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Compute currently displayed image and overlay in ImageViewer
  const currentIntermediates =
    activeTrack === 'vessels'
      ? vesselResult?.intermediate_images
      : discCupResult?.intermediate_images;

  const originalImg =
    currentIntermediates?.original || inspectionData?.previews?.original;

  let displayImg = originalImg;
  if (currentIntermediates && currentIntermediates[activeStageKey as keyof typeof currentIntermediates]) {
    displayImg = currentIntermediates[activeStageKey as keyof typeof currentIntermediates];
  }

  const overlayImg = currentIntermediates?.overlay;

  // Prepare stage items for gallery
  const stageItems =
    activeTrack === 'vessels' && vesselResult
      ? [
          { id: 'original', label: 'Original Fundus', imageUri: vesselResult.intermediate_images.original },
          { id: 'green_channel', label: 'Green Channel', imageUri: vesselResult.intermediate_images.green_channel },
          { id: 'clahe_enhanced', label: 'CLAHE Enhanced', imageUri: vesselResult.intermediate_images.clahe_enhanced },
          { id: 'frangi_heatmap', label: 'Frangi Vesselness', imageUri: vesselResult.intermediate_images.frangi_heatmap },
          { id: 'binary_mask', label: 'Vessel Mask', imageUri: vesselResult.intermediate_images.binary_mask },
          { id: 'overlay', label: 'Vessel Overlay', imageUri: vesselResult.intermediate_images.overlay },
        ]
      : activeTrack === 'disc_cup' && discCupResult
      ? [
          { id: 'original', label: 'Original Fundus', imageUri: discCupResult.intermediate_images.original },
          { id: 'smoothed_response', label: 'Smoothed Luminance', imageUri: discCupResult.intermediate_images.smoothed_response },
          { id: 'disc_mask', label: 'Disc Mask', imageUri: discCupResult.intermediate_images.disc_mask },
          { id: 'cup_mask', label: 'Cup Mask', imageUri: discCupResult.intermediate_images.cup_mask },
          { id: 'overlay', label: 'Disc & Cup Overlay', imageUri: discCupResult.intermediate_images.overlay },
        ]
      : [];

  const hasImageLoaded = uploadedFile !== null || (selectedDataset !== '' && selectedItemId !== '');

  return (
    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-white border border-[#DFE4DF] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Dataset & Sample Picker */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <FolderOpen className="w-4 h-4 text-[#286B56]" />
            <span className="font-semibold text-[#202824]">Source:</span>
          </div>

          {/* Primary Action: Local File Upload */}
          <label className={`flex items-center gap-1.5 text-xs rounded-md px-3 py-1.5 cursor-pointer transition-colors border ${
            uploadedFile
              ? 'bg-[#DCEBE3] text-[#286B56] border-[#286B56]/40 font-medium'
              : 'bg-white hover:bg-[#F5F6F4] text-[#202824] border-[#DFE4DF]'
          }`}>
            <Upload className="w-3.5 h-3.5 text-[#286B56]" />
            <span className="truncate max-w-[220px]">
              {uploadedFile ? uploadedFile.name : 'Upload Fundus Scan'}
            </span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Installed external dataset selector (only if user installed DRIVE / Drishti-GS) */}
          {datasets.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#69736D]">or installed dataset:</span>
              <select
                value={selectedDataset}
                onChange={(e) => {
                  setSelectedDataset(e.target.value);
                  setUploadedFile(null);
                  const ds = datasets.find((d) => d.name === e.target.value);
                  if (ds && ds.items.length > 0) {
                    setSelectedItemId(ds.items[0].id);
                  } else {
                    setSelectedItemId('');
                  }
                }}
                className="text-xs bg-[#F5F6F4] border border-[#DFE4DF] rounded-md px-2.5 py-1.5 text-[#202824]"
              >
                <option value="">Select Dataset...</option>
                {datasets.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.total_images} scans)
                  </option>
                ))}
              </select>

              {selectedDataset && (
                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    setUploadedFile(null);
                  }}
                  className="text-xs bg-[#F5F6F4] border border-[#DFE4DF] rounded-md px-2.5 py-1.5 font-mono text-[#202824]"
                >
                  {datasets
                    .find((d) => d.name === selectedDataset)
                    ?.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.id} [{it.split}]
                      </option>
                    )) || <option value="">No items</option>}
                </select>
              )}
            </div>
          )}

          {/* Optional Reference Annotation Toggle */}
          {uploadedFile && (
            <button
              onClick={() => setShowGtUpload(!showGtUpload)}
              className="flex items-center gap-1 text-[11px] text-[#69736D] hover:text-[#286B56] px-2 py-1 rounded border border-[#DFE4DF] bg-white transition-colors cursor-pointer"
              title="Optionally upload a manual expert mask to calculate Dice and IoU metrics"
            >
              <FileCheck className="w-3.5 h-3.5 text-[#286B56]" />
              <span>Reference Annotation Mask</span>
              {showGtUpload ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Processing Track Selection & Run Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#F5F6F4] p-0.5 rounded-md border border-[#DFE4DF]">
            <button
              onClick={() => setActiveTrack('vessels')}
              className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-all ${
                activeTrack === 'vessels'
                  ? 'bg-white text-[#286B56] shadow-2xs font-semibold'
                  : 'text-[#69736D]'
              }`}
            >
              Track A: Vessels
            </button>
            <button
              onClick={() => setActiveTrack('disc_cup')}
              className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-all ${
                activeTrack === 'disc_cup'
                  ? 'bg-white text-[#286B56] shadow-2xs font-semibold'
                  : 'text-[#69736D]'
              }`}
            >
              Track B: Disc &amp; Cup
            </button>
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={isProcessing || !hasImageLoaded}
            className="flex items-center gap-1.5 bg-[#286B56] hover:bg-[#205746] disabled:opacity-40 text-white text-xs font-medium px-4 py-1.5 rounded-md shadow-xs transition-colors cursor-pointer"
            title={!hasImageLoaded ? 'Upload an image first to run analysis' : 'Execute pipeline'}
          >
            {isProcessing ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Classical DIP...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optional Reference Mask Upload Drawer */}
      {showGtUpload && uploadedFile && (
        <div className="bg-[#F5F6F4] border border-[#DFE4DF] rounded-lg p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#202824]">Optional Ground-Truth Verification Mask</span>
            <span className="text-[11px] text-[#69736D]">
              Supply an expert manual binary segmentation mask to verify quantitative accuracy (Dice, IoU, Sensitivity, Specificity).
            </span>
          </div>

          {activeTrack === 'vessels' ? (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 bg-white border border-[#DFE4DF] rounded px-2.5 py-1 text-xs cursor-pointer text-[#202824]">
                <Upload className="w-3 h-3 text-[#286B56]" />
                <span>{vesselGtFile ? vesselGtFile.name : 'Upload Vessel Reference Mask (PNG/TIF)'}</span>
                <input
                  type="file"
                  accept=".png,.tif,.tiff,.bmp"
                  onChange={(e) => e.target.files && setVesselGtFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
              {vesselGtFile && (
                <button
                  onClick={() => setVesselGtFile(null)}
                  className="text-[11px] text-[#B54747] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 bg-white border border-[#DFE4DF] rounded px-2.5 py-1 text-xs cursor-pointer text-[#202824]">
                <Upload className="w-3 h-3 text-[#286B56]" />
                <span>{discGtFile ? discGtFile.name : 'Upload Disc Reference Mask'}</span>
                <input
                  type="file"
                  accept=".png,.tif,.tiff,.bmp"
                  onChange={(e) => e.target.files && setDiscGtFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
              <label className="flex items-center gap-1.5 bg-white border border-[#DFE4DF] rounded px-2.5 py-1 text-xs cursor-pointer text-[#202824]">
                <Upload className="w-3 h-3 text-[#286B56]" />
                <span>{cupGtFile ? cupGtFile.name : 'Upload Cup Reference Mask'}</span>
                <input
                  type="file"
                  accept=".png,.tif,.tiff,.bmp"
                  onChange={(e) => e.target.files && setCupGtFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
              {(discGtFile || cupGtFile) && (
                <button
                  onClick={() => {
                    setDiscGtFile(null);
                    setCupGtFile(null);
                  }}
                  className="text-[11px] text-[#B54747] hover:underline"
                >
                  Clear Reference Masks
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-xs text-[#B54747] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Viewer + Telemetry & Quantitative Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left 3 Columns: Interactive Image Canvas & Stages */}
        <div className="lg:col-span-3 space-y-3">
          <ImageViewer
            primaryImage={displayImg}
            overlayImage={activeStageKey === 'overlay' ? undefined : overlayImg}
            splitImage={overlayImg}
            imageDimensions={inspectionData?.metadata}
            onUpload={(file) => {
              setUploadedFile(file);
              setSelectedDataset('');
              setSelectedItemId('');
            }}
            title={
              !hasImageLoaded
                ? 'Retinal Fundus Canvas (Awaiting Upload)'
                : activeTrack === 'vessels'
                ? `Track A: Vessel Extraction (${activeStageKey.replace(/_/g, ' ')})`
                : `Track B: Disc & Cup Boundary (${activeStageKey.replace(/_/g, ' ')})`
            }
          />

          {/* Intermediate Stage Selector */}
          {stageItems.length > 0 && (
            <StageGallery
              stages={stageItems}
              selectedStageId={activeStageKey}
              onSelectStage={(id) => setActiveStageKey(id)}
            />
          )}
        </div>

        {/* Right 1 Column: Scientific Telemetry & Quantitative Metrics */}
        <div className="space-y-3">
          {/* Metadata Card */}
          <div className="bg-white border border-[#DFE4DF] rounded-lg p-3 text-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#DFE4DF]">
              <span className="font-semibold text-[#202824]">Image Inspection</span>
              <span className="font-mono text-[10px] text-[#69736D]">
                {inspectionData ? (inspectionData.is_fov_estimated ? 'Estimated FOV' : 'Native FOV') : 'No Scan Loaded'}
              </span>
            </div>

            {inspectionData ? (
              <div className="font-mono text-[11px] space-y-1">
                <div className="flex justify-between text-[#69736D]">
                  <span>Dimensions:</span>
                  <span className="text-[#202824]">
                    {inspectionData.metadata.width} × {inspectionData.metadata.height} px
                  </span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Channels:</span>
                  <span className="text-[#202824]">{inspectionData.metadata.channels} (RGB)</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Aspect Ratio:</span>
                  <span className="text-[#202824]">{inspectionData.metadata.aspect_ratio}</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>FOV Masking:</span>
                  <span className="text-[#286B56] font-medium">Active (Border-Excluded)</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[#69736D] py-2 leading-relaxed">
                Upload a fundus photograph to inspect optical resolution, channels, and Field-of-View boundaries.
              </p>
            )}
          </div>

          {/* Execution CPU Latency */}
          {(vesselResult || discCupResult) ? (
            <ExecutionTimer
              telemetry={
                activeTrack === 'vessels'
                  ? vesselResult?.telemetry
                  : discCupResult?.telemetry
              }
            />
          ) : (
            <div className="bg-white border border-[#DFE4DF] rounded-lg p-3 text-xs text-[#69736D]">
              <div className="font-semibold text-[#202824] pb-1 border-b border-[#DFE4DF] mb-2">
                Pipeline Telemetry
              </div>
              <p className="text-[11px] leading-relaxed">
                Wall-clock CPU execution latency profiled via <code className="font-mono bg-[#F5F6F4] px-1 py-0.5 rounded text-[#202824]">time.perf_counter()</code> will appear after running analysis.
              </p>
            </div>
          )}

          {/* Quantitative Metrics Badge */}
          {activeTrack === 'vessels' && vesselResult && (
            <MetricsBadge
              title="Track A Measurements"
              metrics={vesselResult.ground_truth_metrics}
              vesselDensity={vesselResult.vessel_density}
            />
          )}

          {activeTrack === 'disc_cup' && discCupResult && (
            <div className="space-y-3">
              <MetricsBadge
                title="Track B Measurements"
                metrics={discCupResult.disc_metrics}
                vcdr={discCupResult.vertical_cdr}
                cdrError={discCupResult.cdr_absolute_error}
              />

              {/* Geometric Biomarker Details */}
              <div className="bg-white border border-[#DFE4DF] rounded-lg p-3 text-xs space-y-1.5 font-mono">
                <span className="font-semibold font-sans text-[#202824] block pb-1 border-b border-[#DFE4DF]">
                  Morphometric Diameters
                </span>
                <div className="flex justify-between text-[#69736D]">
                  <span>Disc Vert Diameter:</span>
                  <span className="text-[#202824] font-medium">{discCupResult.disc_diameter_vertical_px} px</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Cup Vert Diameter:</span>
                  <span className="text-[#202824] font-medium">{discCupResult.cup_diameter_vertical_px} px</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Disc Area:</span>
                  <span className="text-[#202824]">{discCupResult.disc_area_px} px²</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Cup Area:</span>
                  <span className="text-[#202824]">{discCupResult.cup_area_px} px²</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Containment:</span>
                  <span className="text-[#286B56] font-medium">100% Inside Disc</span>
                </div>
              </div>

              {/* Diagnostic Warnings */}
              {discCupResult.warnings.length > 0 && (
                <div className="p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[11px] text-[#B7791F] space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Contour Advisory</span>
                  </div>
                  {discCupResult.warnings.map((w, idx) => (
                    <p key={idx}>{w}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
