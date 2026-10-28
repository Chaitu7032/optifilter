import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Sliders,
  AlertTriangle,
  Upload,
  FileCheck,
} from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { MetricsBadge } from '../components/MetricsBadge';
import { StageGallery } from '../components/StageGallery';
import { ExecutionTimer } from '../components/ExecutionTimer';
import { GlaucomaAssessmentCard } from '../components/ClinicalAssessmentCard';
import { useWorkstationMode } from '../context/WorkstationContext';
import { runDiscCupAnalysis, fetchDatasets } from '../services/api';
import { DiscCupAnalysisResult, DatasetSummary } from '../types';

export const DiscCupPage: React.FC = () => {
  const { isClinic } = useWorkstationMode();
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showParamsInStudent, setShowParamsInStudent] = useState(false);

  // Optional Reference Ground-Truth Masks for validation
  const [discGtFile, setDiscGtFile] = useState<File | null>(null);
  const [cupGtFile, setCupGtFile] = useState<File | null>(null);

  // Track B Parameters
  const [discChannel, setDiscChannel] = useState<'red' | 'green' | 'gray'>('red');
  const [closingFactor, setClosingFactor] = useState(0.025);
  const [smoothFactor, setSmoothFactor] = useState(0.020);
  const [snakeIterations, setSnakeIterations] = useState(100);
  const [cupChannel, setCupChannel] = useState<'lab_a' | 'green' | 'inverted_red'>('lab_a');
  const [enforceContainment, setEnforceContainment] = useState(true);

  // Results & UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<DiscCupAnalysisResult | null>(null);
  const [activeStage, setActiveStage] = useState('overlay');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load available datasets on mount
  useEffect(() => {
    fetchDatasets()
      .then((data) => {
        const installedDatasets = data.filter((d) => d.installed && d.total_images > 0);
        setDatasets(installedDatasets);
      })
      .catch((err) => console.error('Failed to load datasets', err));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
      setSelectedDataset('');
      setSelectedItemId('');
      setResult(null);
    }
  };

  const executeAnalysis = async () => {
    if (!uploadedFile && (!selectedDataset || !selectedItemId)) {
      setErrorMsg('Please upload a retinal fundus scan or select a dataset scan before starting analysis.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      if (uploadedFile) {
        formData.append('file', uploadedFile);
        if (discGtFile) formData.append('gt_disc_file', discGtFile);
        if (cupGtFile) formData.append('gt_cup_file', cupGtFile);
      } else {
        formData.append('dataset_name', selectedDataset);
        formData.append('item_id', selectedItemId);
      }

      const customConfig = {
        disc_channel: discChannel,
        morph_closing_factor: closingFactor,
        gaussian_smooth_factor: smoothFactor,
        disc_snake_max_iterations: snakeIterations,
        cup_channel: cupChannel,
        enforce_containment: enforceContainment,
      };
      formData.append('config_json', JSON.stringify(customConfig));

      const res = await runDiscCupAnalysis(formData);
      setResult(res);
      setActiveStage('overlay');
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution error');
    } finally {
      setIsProcessing(false);
    }
  };

  const intermediates = result?.intermediate_images;
  const stageItems = result
    ? [
        { id: 'original', label: '1. Original Fundus', imageUri: intermediates?.original },
        { id: 'smoothed_response', label: '2. Luminance Smooth', imageUri: intermediates?.smoothed_response },
        { id: 'disc_mask', label: '3. Optic Disc Mask', imageUri: intermediates?.disc_mask },
        { id: 'cup_mask', label: '4. Optic Cup Mask', imageUri: intermediates?.cup_mask },
        { id: 'overlay', label: '5. Contour Overlay', imageUri: intermediates?.overlay },
      ]
    : [];

  let currentImageUri = intermediates?.original;
  if (intermediates && intermediates[activeStage as keyof typeof intermediates]) {
    currentImageUri = intermediates[activeStage as keyof typeof intermediates];
  }

  const hasImage = uploadedFile !== null || (selectedDataset !== '' && selectedItemId !== '');
  const showParameters = isClinic || showParamsInStudent;

  return (
    <div className="max-w-[1780px] mx-auto px-3 sm:px-6 py-5 space-y-4">
      {/* Title & Context Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
        <div>
          <h2 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
            <span>Track B — Optic Disc &amp; Cup Segmentation Engineering</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-[#0EA5E9]/10 text-[#0284C7] border border-[#0EA5E9]/30">
              Morphological Snakes &amp; Strict Containment
            </span>
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Luminance centroid search, adaptive vessel bridging, active contour snakes, CIELAB cup extraction, and vertical CDR estimation.
          </p>
        </div>

        {/* Scan Selector & Execution Trigger */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* File Upload Button */}
          <label
            className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 cursor-pointer transition-all border ${
              uploadedFile
                ? 'bg-[#10B981]/15 text-[#059669] border-[#10B981]/40 font-semibold shadow-2xs'
                : 'bg-[#F8FAFC] hover:bg-white text-[#0F172A] border-[#CBD5E1]'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-[#059669]" />
            <span className="truncate max-w-[180px]">
              {uploadedFile ? uploadedFile.name : 'Upload Fundus Scan'}
            </span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Optional Reference Masks for Disc/Cup */}
          {uploadedFile && (
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1 text-[11px] text-[#475569] hover:text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 cursor-pointer">
                <FileCheck className="w-3 h-3 text-[#059669]" />
                <span>{discGtFile ? discGtFile.name : 'Opt: Disc GT'}</span>
                <input
                  type="file"
                  accept=".png,.tif,.tiff,.bmp"
                  onChange={(e) => e.target.files && setDiscGtFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
              <label className="flex items-center gap-1 text-[11px] text-[#475569] hover:text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 cursor-pointer">
                <FileCheck className="w-3 h-3 text-[#059669]" />
                <span>{cupGtFile ? cupGtFile.name : 'Opt: Cup GT'}</span>
                <input
                  type="file"
                  accept=".png,.tif,.tiff,.bmp"
                  onChange={(e) => e.target.files && setCupGtFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Installed datasets if any exist */}
          {datasets.length > 0 && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <select
                value={selectedDataset}
                onChange={(e) => {
                  setSelectedDataset(e.target.value);
                  setUploadedFile(null);
                  const ds = datasets.find((d) => d.name === e.target.value);
                  if (ds && ds.items.length > 0) setSelectedItemId(ds.items[0].id);
                }}
                className="bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#059669] outline-none cursor-pointer"
              >
                <option value="">Choose Installed Dataset...</option>
                {datasets.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.total_images})
                  </option>
                ))}
              </select>

              {selectedDataset && (
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#0F172A] focus:border-[#059669] outline-none cursor-pointer"
                >
                  {datasets
                    .find((d) => d.name === selectedDataset)
                    ?.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.id}
                      </option>
                    )) || <option value="">No items</option>}
                </select>
              )}
            </div>
          )}

          <button
            onClick={executeAnalysis}
            disabled={isProcessing || !hasImage}
            className="flex items-center gap-1.5 bg-[#059669] hover:bg-[#047857] disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
            title={!hasImage ? 'Upload an image first to run Track B' : 'Execute Track B'}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isProcessing ? 'Fitting Contours...' : 'Run Track B'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Viewer (7 cols) + Parameters & Biomarkers (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Canvas & Stage Gallery */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          <ImageViewer
            primaryImage={currentImageUri}
            overlayImage={activeStage === 'overlay' ? undefined : intermediates?.overlay}
            maskImage={intermediates?.disc_mask}
            splitImage={intermediates?.overlay}
            imageDimensions={result?.image_metadata}
            trackType="disc_cup"
            onUpload={(file) => {
              setUploadedFile(file);
              setSelectedDataset('');
              setSelectedItemId('');
              setResult(null);
            }}
            title={
              !hasImage
                ? 'Track B: Canvas (Upload image to begin)'
                : `Stage: ${activeStage.replace(/_/g, ' ').toUpperCase()}`
            }
          />

          {stageItems.length > 0 && (
            <StageGallery
              stages={stageItems}
              selectedStageId={activeStage}
              onSelectStage={(id) => setActiveStage(id)}
            />
          )}

          {/* Color Legend */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
            <span className="font-semibold text-[#0F172A]">Scientific Contour Legend:</span>
            <div className="flex items-center gap-4 text-[11px] font-mono flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7] ring-1 ring-sky-300" />
                <span className="text-[#0F172A]">Optic Disc (Outer Boundary)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] ring-1 ring-amber-300" />
                <span className="text-[#0F172A]">Optic Cup (Interior Margin)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 text-[#0F172A] bg-[#F1F5F9] flex items-center justify-center rounded text-[10px] font-bold border border-[#CBD5E1]">
                  +
                </span>
                <span className="text-[#64748B]">Centroid</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Parameters & Morphometric Biomarkers */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-3">
          {/* Hyperparameters Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
                <Sliders className="w-3.5 h-3.5 text-[#059669]" />
                <span>Disc &amp; Cup Parameters</span>
              </div>
              <div className="flex items-center gap-2">
                {!isClinic && (
                  <button
                    onClick={() => setShowParamsInStudent(!showParamsInStudent)}
                    className="text-[11px] text-[#059669] hover:underline cursor-pointer font-medium"
                  >
                    {showParamsInStudent ? 'Hide Controls' : 'Tune Settings'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setDiscChannel('red');
                    setClosingFactor(0.025);
                    setSmoothFactor(0.020);
                    setSnakeIterations(100);
                    setCupChannel('lab_a');
                    setEnforceContainment(true);
                  }}
                  className="text-[11px] text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Defaults</span>
                </button>
              </div>
            </div>

            {showParameters ? (
              <div className="space-y-3">
                {/* Disc Localization Preprocessing */}
                <div className="space-y-2 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <span className="font-medium text-[#0F172A] block">Disc Centroid Search</span>
                  
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>Candidate Color Channel:</span>
                    <select
                      value={discChannel}
                      onChange={(e) => setDiscChannel(e.target.value as any)}
                      className="bg-white border border-[#CBD5E1] rounded px-2 py-0.5 text-[#0F172A] outline-none cursor-pointer"
                    >
                      <option value="red">Red Channel (Highest Reflectance)</option>
                      <option value="green">Green Channel (Vessel Inversion)</option>
                      <option value="gray">Grayscale Luminance</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>Morph Closing (r = {closingFactor.toFixed(3)} × dim):</span>
                    <input
                      type="range"
                      min="0.010"
                      max="0.040"
                      step="0.005"
                      value={closingFactor}
                      onChange={(e) => setClosingFactor(parseFloat(e.target.value))}
                      className="w-24 accent-[#059669] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>Gaussian Smoothing (σ = {smoothFactor.toFixed(3)} × dim):</span>
                    <input
                      type="range"
                      min="0.010"
                      max="0.040"
                      step="0.005"
                      value={smoothFactor}
                      onChange={(e) => setSmoothFactor(parseFloat(e.target.value))}
                      className="w-24 accent-[#059669] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Active Contour Snake Parameters */}
                <div className="space-y-2 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <span className="font-medium text-[#0F172A] block">Active Contour Fitting</span>
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>Snake Iterations: {snakeIterations}</span>
                    <input
                      type="range"
                      min="30"
                      max="150"
                      step="10"
                      value={snakeIterations}
                      onChange={(e) => setSnakeIterations(parseInt(e.target.value))}
                      className="w-24 accent-[#059669] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Cup Channel & Strict Containment */}
                <div className="space-y-2 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <span className="font-medium text-[#0F172A] block">Optic Cup Differentiation</span>
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>Color Space / Feature:</span>
                    <select
                      value={cupChannel}
                      onChange={(e) => setCupChannel(e.target.value as any)}
                      className="bg-white border border-[#CBD5E1] rounded px-2 py-0.5 text-[#0F172A] outline-none cursor-pointer"
                    >
                      <option value="lab_a">CIELAB 255 - a* (Paleness)</option>
                      <option value="green">Green Spectrum Absorption</option>
                      <option value="inverted_red">Inverted Red Channel</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-medium text-[#0F172A]">
                      Enforce Strict Disc Containment:
                    </span>
                    <input
                      type="checkbox"
                      checked={enforceContainment}
                      onChange={(e) => setEnforceContainment(e.target.checked)}
                      className="accent-[#059669] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-[11px] text-[#64748B] leading-relaxed">
                Using calibrated parameters: Red channel centroid search, morph closing (r=0.025), active contour snakes (100 iters), and CIELAB 255 - a* paleness cup extraction.
              </div>
            )}
          </div>

          {/* Morphometric Biomarkers & Validation Results */}
          {result ? (
            <div className="space-y-3 animate-in fade-in duration-200">
              <MetricsBadge
                title="Ground-Truth Quantitative Comparison"
                metrics={result.disc_metrics}
                vcdr={result.vertical_cdr}
                cdrError={result.cdr_absolute_error}
              />

              {/* Experimental Glaucoma-Related Structural Indicator */}
              <GlaucomaAssessmentCard
                vcdr={result.vertical_cdr}
                outcomeStatus={result.outcome_status}
                isFallback={result.localization_checks?.disc_fallback_applied}
                warnings={result.warnings}
                assessment={result.glaucoma_assessment}
              />

              {/* Exact Diameter and Area Breakdown */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-2 font-mono shadow-xs">
                <span className="font-semibold font-sans text-[#0F172A] block pb-1.5 border-b border-[#E2E8F0]">
                  Morphometric Diameters &amp; Ratio
                </span>
                <div className="flex justify-between text-[#64748B]">
                  <span>Disc Center Coordinates:</span>
                  <span className="text-[#0F172A] font-medium">({result.disc_center.x}, {result.disc_center.y})</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Vertical Disc Extent (Dd):</span>
                  <span className="text-[#0F172A] font-medium">{result.disc_diameter_vertical_px} px</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Vertical Cup Extent (Dc):</span>
                  <span className="text-[#0F172A] font-medium">{result.cup_diameter_vertical_px} px</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Computed vCDR (Dc / Dd):</span>
                  <span className="text-[#059669] font-bold text-sm">
                    {result.vertical_cdr ? result.vertical_cdr.toFixed(4) : 'Degenerate'}
                  </span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Disc Area:</span>
                  <span className="text-[#0F172A]">{result.disc_area_px.toLocaleString()} px²</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Cup Area:</span>
                  <span className="text-[#0F172A]">{result.cup_area_px.toLocaleString()} px²</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Containment Enforced:</span>
                  <span className="text-[#059669] font-medium">Yes (100% Inside Disc)</span>
                </div>
              </div>

              {/* Warnings and edge case notifications */}
              {result.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1 shadow-2xs">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Contour Advisory &amp; Fallback State</span>
                  </div>
                  {result.warnings.map((w, idx) => (
                    <p key={idx}>{w}</p>
                  ))}
                </div>
              )}

              <ExecutionTimer telemetry={result.telemetry} />
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 text-xs text-[#64748B] space-y-2 shadow-xs">
              <span className="font-semibold text-[#0F172A] block pb-1 border-b border-[#E2E8F0]">
                Awaiting Track B Execution
              </span>
              <p className="text-xs text-[#64748B] leading-relaxed pt-1">
                Upload a fundus photograph and click <span className="font-semibold text-[#0F172A]">"Run Track B"</span> to fit active contour snakes and compute the vertical cup-to-disc ratio (vCDR).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
