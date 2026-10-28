import React, { useState, useEffect } from 'react';
import {
  Upload,
  Play,
  RotateCw,
  FolderOpen,
  AlertTriangle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Activity,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { MetricsBadge } from '../components/MetricsBadge';
import { StageGallery } from '../components/StageGallery';
import { ExecutionTimer } from '../components/ExecutionTimer';
import { GlaucomaAssessmentCard, DiabeticRetinopathyCard } from '../components/ClinicalAssessmentCard';
import { useWorkstationMode } from '../context/WorkstationContext';
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
  const { isClinic } = useWorkstationMode();

  // Datasets & Sample Selection
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

  // Load available datasets on mount
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
      setErrorMessage('Please upload a retinal fundus scan or select a dataset scan before running analysis.');
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

  // Compute currently displayed image, mask and overlay in ImageViewer
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
  const maskImg =
    activeTrack === 'vessels'
      ? vesselResult?.intermediate_images?.binary_mask
      : discCupResult?.intermediate_images?.disc_mask;

  // Prepare stage items for gallery
  const stageItems =
    activeTrack === 'vessels' && vesselResult
      ? [
          { id: 'original', label: '1. Original Fundus', imageUri: vesselResult.intermediate_images.original },
          { id: 'green_channel', label: '2. Green Channel', imageUri: vesselResult.intermediate_images.green_channel },
          { id: 'clahe_enhanced', label: '3. CLAHE Enhanced', imageUri: vesselResult.intermediate_images.clahe_enhanced },
          { id: 'frangi_heatmap', label: '4. Frangi Response', imageUri: vesselResult.intermediate_images.frangi_heatmap },
          { id: 'binary_mask', label: '5. Vessel Mask', imageUri: vesselResult.intermediate_images.binary_mask },
          { id: 'overlay', label: '6. Segmented Overlay', imageUri: vesselResult.intermediate_images.overlay },
        ]
      : activeTrack === 'disc_cup' && discCupResult
      ? [
          { id: 'original', label: '1. Original Fundus', imageUri: discCupResult.intermediate_images.original },
          { id: 'smoothed_response', label: '2. Luminance Smooth', imageUri: discCupResult.intermediate_images.smoothed_response },
          { id: 'disc_mask', label: '3. Disc Mask', imageUri: discCupResult.intermediate_images.disc_mask },
          { id: 'cup_mask', label: '4. Cup Mask', imageUri: discCupResult.intermediate_images.cup_mask },
          { id: 'overlay', label: '5. Disc & Cup Overlay', imageUri: discCupResult.intermediate_images.overlay },
        ]
      : [];

  const hasImageLoaded = uploadedFile !== null || (selectedDataset !== '' && selectedItemId !== '');

  return (
    <div className="max-w-[1780px] mx-auto px-3 sm:px-6 py-5 space-y-4">
      {/* Student Mode Guided Stepper Banner */}
      {!isClinic && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#059669]/10 text-[#059669] flex items-center justify-center font-bold text-xs">
              🎓
            </span>
            <div>
              <span className="font-semibold text-[#0F172A]">Student Demonstration Workflow: </span>
              <span className="text-[#64748B]">
                Select a retinal scan, choose the target clinical track, run the deterministic DIP pipeline, and inspect the structural biomarkers.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#64748B] bg-[#F8FAFC] px-2.5 py-1 rounded-md border border-[#E2E8F0]">
            <span>1. Select Scan</span>
            <ArrowRight className="w-3 h-3 text-[#059669]" />
            <span>2. Track</span>
            <ArrowRight className="w-3 h-3 text-[#059669]" />
            <span>3. Segment</span>
            <ArrowRight className="w-3 h-3 text-[#059669]" />
            <span className="text-[#059669] font-bold">4. Biomarkers</span>
          </div>
        </div>
      )}

      {/* Main Controls Command Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        {/* Dataset & Sample Picker */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] mr-1">
            <FolderOpen className="w-4 h-4 text-[#059669]" />
            <span className="font-semibold text-[#0F172A]">Input Source:</span>
          </div>

          {/* Primary Action: Local File Upload */}
          <label
            className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 cursor-pointer transition-all border ${
              uploadedFile
                ? 'bg-[#10B981]/15 text-[#059669] border-[#10B981]/40 font-semibold shadow-2xs'
                : 'bg-[#F8FAFC] hover:bg-white text-[#0F172A] border-[#CBD5E1]'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-[#059669]" />
            <span className="truncate max-w-[200px]">
              {uploadedFile ? uploadedFile.name : 'Upload Local Scan'}
            </span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Installed External Dataset Selector (DRIVE / Drishti-GS) */}
          {datasets.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-[#64748B]">or load from:</span>
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
                className="text-xs bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[#0F172A] focus:border-[#059669] outline-none cursor-pointer"
              >
                <option value="">Choose Research Dataset...</option>
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
                  className="text-xs bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 font-mono text-[#0F172A] focus:border-[#059669] outline-none cursor-pointer"
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

          {/* Reference Ground-Truth Upload Toggle */}
          {uploadedFile && (
            <button
              onClick={() => setShowGtUpload(!showGtUpload)}
              className="flex items-center gap-1 text-[11px] text-[#475569] hover:text-[#0F172A] px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white transition-colors cursor-pointer"
              title="Supply an expert manual binary segmentation mask to verify quantitative accuracy (Dice, IoU, Sensitivity)"
            >
              <FileCheck className="w-3.5 h-3.5 text-[#059669]" />
              <span>Reference Annotation</span>
              {showGtUpload ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Processing Track Selection & Run Button */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
            <button
              onClick={() => setActiveTrack('vessels')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
                activeTrack === 'vessels'
                  ? 'bg-white text-[#059669] border border-[#E2E8F0] shadow-xs font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A] border border-transparent'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Track A: Vessels</span>
            </button>
            <button
              onClick={() => setActiveTrack('disc_cup')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
                activeTrack === 'disc_cup'
                  ? 'bg-white text-[#0284C7] border border-[#E2E8F0] shadow-xs font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A] border border-transparent'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Track B: Disc &amp; Cup</span>
            </button>
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={isProcessing || !hasImageLoaded}
            className="flex items-center gap-1.5 bg-[#059669] hover:bg-[#047857] disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            title={!hasImageLoaded ? 'Upload an image first to run analysis' : 'Execute classical DIP pipeline'}
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
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 text-xs space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#0F172A]">Reference Ground-Truth Mask Verification</span>
            <span className="text-[11px] text-[#64748B]">
              Supply an expert manual binary segmentation mask to verify quantitative accuracy (Dice, IoU, Sensitivity, Specificity).
            </span>
          </div>

          {activeTrack === 'vessels' ? (
            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-lg px-3 py-1.5 text-xs cursor-pointer text-[#0F172A] hover:border-[#059669]">
                <Upload className="w-3.5 h-3.5 text-[#059669]" />
                <span>{vesselGtFile ? vesselGtFile.name : 'Upload Vessel Ground-Truth Mask (PNG/TIF)'}</span>
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
                  className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Mask
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-lg px-3 py-1.5 text-xs cursor-pointer text-[#0F172A] hover:border-[#059669]">
                <Upload className="w-3.5 h-3.5 text-[#059669]" />
                <span>{discGtFile ? discGtFile.name : 'Upload Disc Reference Mask'}</span>
                <input
                  type="file"
                  accept=".png,.tif,.tiff,.bmp"
                  onChange={(e) => e.target.files && setDiscGtFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
              <label className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-lg px-3 py-1.5 text-xs cursor-pointer text-[#0F172A] hover:border-[#059669]">
                <Upload className="w-3.5 h-3.5 text-[#059669]" />
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
                  className="text-[11px] text-rose-600 hover:underline cursor-pointer"
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
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Viewer Centerpiece + Telemetry & Quantitative Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Columns: Interactive Image Canvas Centerpiece & Stages */}
        <div className="lg:col-span-8 xl:col-span-8 space-y-3">
          <ImageViewer
            primaryImage={displayImg}
            overlayImage={activeStageKey === 'overlay' ? undefined : overlayImg}
            maskImage={maskImg}
            splitImage={overlayImg}
            imageDimensions={inspectionData?.metadata}
            trackType={activeTrack}
            onUpload={(file) => {
              setUploadedFile(file);
              setSelectedDataset('');
              setSelectedItemId('');
            }}
            title={
              !hasImageLoaded
                ? 'Retinal Fundus Canvas'
                : activeTrack === 'vessels'
                ? `Track A: Vessel Extraction — ${activeStageKey.replace(/_/g, ' ').toUpperCase()}`
                : `Track B: Disc & Cup Contour — ${activeStageKey.replace(/_/g, ' ').toUpperCase()}`
            }
          />

          {/* Intermediate Stage Selector Filmstrip */}
          {stageItems.length > 0 && (
            <StageGallery
              stages={stageItems}
              selectedStageId={activeStageKey}
              onSelectStage={(id) => setActiveStageKey(id)}
            />
          )}
        </div>

        {/* Right Columns: Scientific Telemetry & Quantitative Metrics */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-3">
          {/* Metadata Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span className="font-semibold text-[#0F172A]">Image Optical Inspection</span>
              <span className="font-mono text-[10px] text-[#475569] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
                {inspectionData ? (inspectionData.is_fov_estimated ? 'Estimated FOV' : 'Dataset Native FOV') : 'No Scan Loaded'}
              </span>
            </div>

            {inspectionData ? (
              <div className="font-mono text-[11px] space-y-1.5">
                <div className="flex justify-between text-[#64748B]">
                  <span>Resolution:</span>
                  <span className="text-[#0F172A] font-medium">
                    {inspectionData.metadata.width} × {inspectionData.metadata.height} px
                  </span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Channels:</span>
                  <span className="text-[#0F172A]">{inspectionData.metadata.channels} (RGB)</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Aspect Ratio:</span>
                  <span className="text-[#0F172A]">{inspectionData.metadata.aspect_ratio}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>FOV Boundary:</span>
                  <span className="text-[#059669] font-medium">Active (Rim-Excluded)</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] py-2 leading-relaxed">
                Upload or select a fundus photograph to inspect optical resolution, channels, and Field-of-View boundaries.
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
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs text-[#64748B] space-y-1.5 shadow-xs">
              <div className="font-semibold text-[#0F172A] pb-1 border-b border-[#E2E8F0]">
                Pipeline Telemetry Profiler
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Deterministic wall-clock latency profiled via Python <code className="font-mono bg-[#F8FAFC] px-1.5 py-0.5 rounded text-[#0F172A] border border-[#E2E8F0]">time.perf_counter()</code> will appear after running analysis.
              </p>
            </div>
          )}

          {/* Quantitative Metrics Badge & Clinical Assessment */}
          {activeTrack === 'vessels' && vesselResult && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <MetricsBadge
                title="Track A Measurements"
                metrics={vesselResult.ground_truth_metrics}
                vesselDensity={vesselResult.vessel_density}
              />
              <DiabeticRetinopathyCard
                vesselDensity={vesselResult.vessel_density}
                assessment={vesselResult.dr_assessment}
              />
            </div>
          )}

          {activeTrack === 'disc_cup' && discCupResult && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <MetricsBadge
                title="Track B Measurements"
                metrics={discCupResult.disc_metrics}
                vcdr={discCupResult.vertical_cdr}
                cdrError={discCupResult.cdr_absolute_error}
              />
              <GlaucomaAssessmentCard
                vcdr={discCupResult.vertical_cdr}
                outcomeStatus={discCupResult.outcome_status}
                isFallback={discCupResult.localization_checks?.disc_fallback_applied}
                warnings={discCupResult.warnings}
                assessment={discCupResult.glaucoma_assessment}
              />

              {/* Geometric Biomarker Details in Clinic Mode */}
              {isClinic && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-2 font-mono shadow-xs">
                  <span className="font-semibold font-sans text-[#0F172A] block pb-1.5 border-b border-[#E2E8F0]">
                    Morphometric Diameters &amp; Areas
                  </span>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Disc Vertical Extent:</span>
                    <span className="text-[#0F172A] font-medium">{discCupResult.disc_diameter_vertical_px} px</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Cup Vertical Extent:</span>
                    <span className="text-[#0F172A] font-medium">{discCupResult.cup_diameter_vertical_px} px</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Disc Area:</span>
                    <span className="text-[#0F172A]">{discCupResult.disc_area_px.toLocaleString()} px²</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Cup Area:</span>
                    <span className="text-[#0F172A]">{discCupResult.cup_area_px.toLocaleString()} px²</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Strict Containment:</span>
                    <span className="text-[#059669] font-medium">100% Inside Disc</span>
                  </div>
                </div>
              )}

              {/* Diagnostic Contour Warnings */}
              {discCupResult.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1 shadow-2xs">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Contour Boundary Advisory</span>
                  </div>
                  {discCupResult.warnings.map((w, idx) => (
                    <p key={idx} className="text-[11px]">{w}</p>
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
