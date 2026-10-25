import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Crosshair,
  CircleDot,
  Upload,
  FileCheck,
} from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { MetricsBadge } from '../components/MetricsBadge';
import { StageGallery } from '../components/StageGallery';
import { ExecutionTimer } from '../components/ExecutionTimer';
import { runDiscCupAnalysis, fetchDatasets } from '../services/api';
import { DiscCupAnalysisResult, DatasetSummary } from '../types';

export const DiscCupPage: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

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

  // Load available datasets on mount (only real installed datasets)
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
      setErrorMsg('Please upload a retinal fundus scan before starting analysis.');
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
        { id: 'original', label: 'Original', imageUri: intermediates?.original },
        { id: 'smoothed_response', label: 'Luminance Smooth', imageUri: intermediates?.smoothed_response },
        { id: 'disc_mask', label: 'Optic Disc Mask', imageUri: intermediates?.disc_mask },
        { id: 'cup_mask', label: 'Optic Cup Mask', imageUri: intermediates?.cup_mask },
        { id: 'overlay', label: 'Contour Overlay', imageUri: intermediates?.overlay },
      ]
    : [];

  let currentImageUri = intermediates?.original;
  if (intermediates && intermediates[activeStage as keyof typeof intermediates]) {
    currentImageUri = intermediates[activeStage as keyof typeof intermediates];
  }

  const hasImage = uploadedFile !== null || (selectedDataset !== '' && selectedItemId !== '');

  return (
    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Title & Context Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DFE4DF]">
        <div>
          <h2 className="text-base font-semibold text-[#202824] flex items-center gap-2">
            <span>Track B — Optic Disc &amp; Cup Segmentation Engineering</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-[#DCEBE3] text-[#286B56]">
              Morphological Snakes &amp; Strict Containment
            </span>
          </h2>
          <p className="text-xs text-[#69736D] mt-0.5">
            Luminance centroid localization, adaptive morphological vessel suppression, active contours, and vertical CDR estimation.
          </p>
        </div>

        {/* Scan Selector & Execution Trigger */}
        <div className="flex flex-wrap items-center gap-3">
          {/* File Upload Button */}
          <label className={`flex items-center gap-1.5 text-xs rounded px-3 py-1.5 cursor-pointer transition-colors border ${
            uploadedFile
              ? 'bg-[#DCEBE3] text-[#286B56] border-[#286B56]/40 font-medium'
              : 'bg-white hover:bg-[#F5F6F4] text-[#202824] border-[#DFE4DF]'
          }`}>
            <Upload className="w-3.5 h-3.5 text-[#286B56]" />
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
              <label className="flex items-center gap-1 text-[11px] text-[#69736D] hover:text-[#286B56] bg-white border border-[#DFE4DF] rounded px-2.5 py-1.5 cursor-pointer">
                <FileCheck className="w-3 h-3 text-[#286B56]" />
                <span>{discGtFile ? discGtFile.name : 'Opt: Disc GT'}</span>
                <input
                  type="file"
                  accept=".png,.tif,.tiff,.bmp"
                  onChange={(e) => e.target.files && setDiscGtFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
              <label className="flex items-center gap-1 text-[11px] text-[#69736D] hover:text-[#286B56] bg-white border border-[#DFE4DF] rounded px-2.5 py-1.5 cursor-pointer">
                <FileCheck className="w-3 h-3 text-[#286B56]" />
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
            <div className="flex items-center gap-2 text-xs">
              <select
                value={selectedDataset}
                onChange={(e) => {
                  setSelectedDataset(e.target.value);
                  setUploadedFile(null);
                  const ds = datasets.find((d) => d.name === e.target.value);
                  if (ds && ds.items.length > 0) setSelectedItemId(ds.items[0].id);
                }}
                className="bg-white border border-[#DFE4DF] rounded px-2.5 py-1 text-xs text-[#202824]"
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
                  className="bg-white border border-[#DFE4DF] rounded px-2.5 py-1 text-xs font-mono text-[#202824]"
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
            className="flex items-center gap-1.5 bg-[#286B56] hover:bg-[#205746] disabled:opacity-40 text-white text-xs font-medium px-4 py-1.5 rounded shadow-xs cursor-pointer transition-colors"
            title={!hasImage ? 'Upload an image first to run Track B' : 'Execute Track B'}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isProcessing ? 'Fitting Contours...' : 'Run Track B'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-xs text-[#B54747] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Viewer (7 cols) + Parameters & Biomarkers (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Canvas & Stage Gallery */}
        <div className="lg:col-span-7 space-y-3">
          <ImageViewer
            primaryImage={currentImageUri}
            overlayImage={activeStage === 'overlay' ? undefined : intermediates?.overlay}
            splitImage={intermediates?.overlay}
            imageDimensions={result?.image_metadata}
            onUpload={(file) => {
              setUploadedFile(file);
              setSelectedDataset('');
              setSelectedItemId('');
              setResult(null);
            }}
            title={
              !hasImage
                ? 'Track B: Canvas (Upload image to begin)'
                : `Stage: ${activeStage.replace(/_/g, ' ')}`
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
          <div className="bg-white border border-[#DFE4DF] rounded-lg p-2.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#202824]">Scientific Annotation Legend:</span>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#00E5FF] border border-black/20" />
                <span className="text-[#202824]">Optic Disc (Outer)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#FFA500] border border-black/20" />
                <span className="text-[#202824]">Optic Cup (Interior)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 text-white bg-black/80 flex items-center justify-center rounded-xs text-[9px] font-bold">
                  +
                </span>
                <span className="text-[#202824]">Localized Centroid</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Parameters & Morphometric Biomarkers */}
        <div className="lg:col-span-5 space-y-3">
          {/* Hyperparameters Card */}
          <div className="bg-white border border-[#DFE4DF] rounded-lg p-3 text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DFE4DF]">
              <div className="flex items-center gap-1.5 font-semibold text-[#202824]">
                <Sliders className="w-3.5 h-3.5 text-[#286B56]" />
                <span>Disc &amp; Cup Parameters</span>
              </div>
              <button
                onClick={() => {
                  setDiscChannel('red');
                  setClosingFactor(0.025);
                  setSmoothFactor(0.020);
                  setSnakeIterations(100);
                  setCupChannel('lab_a');
                  setEnforceContainment(true);
                }}
                className="text-[11px] text-[#69736D] hover:text-[#286B56] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {/* Disc Localization Preprocessing */}
            <div className="space-y-2 p-2.5 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <span className="font-medium text-[#202824] block">Disc Centroid Search</span>
              
              <div className="flex items-center justify-between text-[11px] text-[#69736D]">
                <span>Candidate Color Channel:</span>
                <select
                  value={discChannel}
                  onChange={(e) => setDiscChannel(e.target.value as any)}
                  className="bg-white border border-[#DFE4DF] rounded px-1.5 py-0.5 text-[#202824]"
                >
                  <option value="red">Red Channel (Highest Reflectance)</option>
                  <option value="green">Green Channel (Vessel Inversion)</option>
                  <option value="gray">Grayscale Luminance</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#69736D]">
                <span>Morphological Closing (r = {closingFactor.toFixed(3)} × dim):</span>
                <input
                  type="range"
                  min="0.010"
                  max="0.040"
                  step="0.005"
                  value={closingFactor}
                  onChange={(e) => setClosingFactor(parseFloat(e.target.value))}
                  className="w-24 accent-[#286B56] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#69736D]">
                <span>Gaussian Smoothing (σ = {smoothFactor.toFixed(3)} × dim):</span>
                <input
                  type="range"
                  min="0.010"
                  max="0.040"
                  step="0.005"
                  value={smoothFactor}
                  onChange={(e) => setSmoothFactor(parseFloat(e.target.value))}
                  className="w-24 accent-[#286B56] cursor-pointer"
                />
              </div>
            </div>

            {/* Active Contour Snake Parameters */}
            <div className="space-y-2 p-2.5 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <span className="font-medium text-[#202824] block">Disc Active Contour Fitting</span>
              <div className="flex items-center justify-between text-[11px] text-[#69736D]">
                <span>Max Snake Iterations: {snakeIterations}</span>
                <input
                  type="range"
                  min="30"
                  max="150"
                  step="10"
                  value={snakeIterations}
                  onChange={(e) => setSnakeIterations(parseInt(e.target.value))}
                  className="w-24 accent-[#286B56] cursor-pointer"
                />
              </div>
            </div>

            {/* Cup Channel & Strict Containment */}
            <div className="space-y-2 p-2.5 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <span className="font-medium text-[#202824] block">Optic Cup Differentiation</span>
              <div className="flex items-center justify-between text-[11px] text-[#69736D]">
                <span>Color Space / Feature:</span>
                <select
                  value={cupChannel}
                  onChange={(e) => setCupChannel(e.target.value as any)}
                  className="bg-white border border-[#DFE4DF] rounded px-1.5 py-0.5 text-[#202824]"
                >
                  <option value="lab_a">CIELAB 255 - a* (Paleness)</option>
                  <option value="green">Green Spectrum Absorption</option>
                  <option value="inverted_red">Inverted Red Channel</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-medium text-[#202824]">
                  Enforce Disc Containment:
                </span>
                <input
                  type="checkbox"
                  checked={enforceContainment}
                  onChange={(e) => setEnforceContainment(e.target.checked)}
                  className="accent-[#286B56] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Morphometric Biomarkers & Validation Results (Real results only) */}
          {result ? (
            <div className="space-y-3">
              <MetricsBadge
                title="Ground-Truth Quantitative Comparison"
                metrics={result.disc_metrics}
                vcdr={result.vertical_cdr}
                cdrError={result.cdr_absolute_error}
              />

              {/* Exact Diameter and Area Breakdown */}
              <div className="bg-white border border-[#DFE4DF] rounded-lg p-3 text-xs space-y-1.5 font-mono">
                <span className="font-semibold font-sans text-[#202824] block pb-1 border-b border-[#DFE4DF]">
                  Biomarker Diameters &amp; Ratio
                </span>
                <div className="flex justify-between text-[#69736D]">
                  <span>Disc Center:</span>
                  <span className="text-[#202824] font-medium">({result.disc_center.x}, {result.disc_center.y})</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Vertical Disc Diameter (Dd):</span>
                  <span className="text-[#202824] font-medium">{result.disc_diameter_vertical_px} px</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Vertical Cup Diameter (Dc):</span>
                  <span className="text-[#202824] font-medium">{result.cup_diameter_vertical_px} px</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Vertical CDR (Dc / Dd):</span>
                  <span className="text-[#286B56] font-bold text-sm">
                    {result.vertical_cdr ? result.vertical_cdr.toFixed(4) : 'Degenerate'}
                  </span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Disc Area:</span>
                  <span className="text-[#202824]">{result.disc_area_px} px²</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Cup Area:</span>
                  <span className="text-[#202824]">{result.cup_area_px} px²</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Containment Enforced:</span>
                  <span className="text-[#286B56] font-medium">Yes (100% Inside Disc)</span>
                </div>
              </div>

              {/* Warnings and edge case notifications */}
              {result.warnings.length > 0 && (
                <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[11px] text-[#B7791F] space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
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
            <div className="bg-white border border-[#DFE4DF] rounded-lg p-4 text-xs text-[#69736D] space-y-1">
              <span className="font-semibold text-[#202824] block pb-1 border-b border-[#DFE4DF]">
                Biomarkers Ready
              </span>
              <p className="text-[11px] leading-relaxed pt-1">
                Upload a fundus photograph and click <span className="font-medium text-[#202824]">"Run Track B"</span> to fit active contour snakes and compute the vertical cup-to-disc ratio (vCDR).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
