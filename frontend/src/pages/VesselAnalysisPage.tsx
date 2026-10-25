import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  AlertCircle,
  Upload,
  FileCheck,
} from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { MetricsBadge } from '../components/MetricsBadge';
import { StageGallery } from '../components/StageGallery';
import { ExecutionTimer } from '../components/ExecutionTimer';
import { runVesselAnalysis, fetchDatasets } from '../services/api';
import { VesselAnalysisResult, DatasetSummary } from '../types';

export const VesselAnalysisPage: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [vesselGtFile, setVesselGtFile] = useState<File | null>(null);

  // Configurable DIP Hyperparameters
  const [useClahe, setUseClahe] = useState(true);
  const [claheClipLimit, setClaheClipLimit] = useState(2.0);
  const [claheGridSize, setClaheGridSize] = useState(8);
  const [gaussianDenoise, setGaussianDenoise] = useState(0.5);
  const [thresholdMethod, setThresholdMethod] = useState<'hysteresis' | 'global_otsu' | 'global_percentile'>('hysteresis');
  const [lowPercentile, setLowPercentile] = useState(75.0);
  const [highPercentile, setHighPercentile] = useState(92.0);
  const [minCompSize, setMinCompSize] = useState(25);
  const [frangiScales, setFrangiScales] = useState<number[]>([1.0, 1.5, 2.0, 3.0, 4.0]);

  // Results & UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<VesselAnalysisResult | null>(null);
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
        if (vesselGtFile) {
          formData.append('gt_file', vesselGtFile);
        }
      } else {
        formData.append('dataset_name', selectedDataset);
        formData.append('item_id', selectedItemId);
      }

      const customConfig = {
        use_clahe: useClahe,
        clahe_clip_limit: claheClipLimit,
        clahe_tile_grid_size: claheGridSize,
        gaussian_denoise_sigma: gaussianDenoise,
        threshold_method: thresholdMethod,
        hysteresis_low_percentile: lowPercentile,
        hysteresis_high_percentile: highPercentile,
        min_component_size: minCompSize,
        frangi_sigmas: frangiScales,
      };
      formData.append('config_json', JSON.stringify(customConfig));

      const res = await runVesselAnalysis(formData);
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
        { id: 'green_channel', label: 'Green Ch (540-570nm)', imageUri: intermediates?.green_channel },
        { id: 'clahe_enhanced', label: 'CLAHE Normalized', imageUri: intermediates?.clahe_enhanced },
        { id: 'frangi_heatmap', label: 'Frangi Vesselness', imageUri: intermediates?.frangi_heatmap },
        { id: 'binary_mask', label: 'Thresholded Mask', imageUri: intermediates?.binary_mask },
        { id: 'overlay', label: 'Emerald Overlay', imageUri: intermediates?.overlay },
      ]
    : [];

  let currentImageUri = intermediates?.original;
  if (intermediates && intermediates[activeStage as keyof typeof intermediates]) {
    currentImageUri = intermediates[activeStage as keyof typeof intermediates];
  }

  const hasImage = uploadedFile !== null || (selectedDataset !== '' && selectedItemId !== '');

  return (
    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Page Title & Context Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DFE4DF]">
        <div>
          <h2 className="text-base font-semibold text-[#202824] flex items-center gap-2">
            <span>Track A — Retinal Vessel Segmentation Engineering</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-[#DCEBE3] text-[#286B56]">
              Multiscale Frangi &amp; Hysteresis
            </span>
          </h2>
          <p className="text-xs text-[#69736D] mt-0.5">
            Green channel absorption, local contrast equalization, multiscale Hessian decomposition, and dual-threshold hysteresis.
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

          {/* Optional Reference Mask */}
          {uploadedFile && (
            <label className="flex items-center gap-1 text-[11px] text-[#69736D] hover:text-[#286B56] bg-white border border-[#DFE4DF] rounded px-2.5 py-1.5 cursor-pointer">
              <FileCheck className="w-3 h-3 text-[#286B56]" />
              <span>{vesselGtFile ? vesselGtFile.name : 'Opt: Reference Mask'}</span>
              <input
                type="file"
                accept=".png,.tif,.tiff,.bmp"
                onChange={(e) => e.target.files && setVesselGtFile(e.target.files[0])}
                className="hidden"
              />
            </label>
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
            title={!hasImage ? 'Upload an image first to run pipeline' : 'Execute pipeline'}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isProcessing ? 'Calculating Frangi Hessian...' : 'Run Pipeline'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-xs text-[#B54747] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Workspace Layout: Canvas + Parameter Controls + Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Image Canvas & Intermediate Stage Navigator (7 cols) */}
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
                ? 'Track A: Canvas (Upload image to begin)'
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
        </div>

        {/* Right Column: Interactive Parameter Tuning & Mathematical Telemetry (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Hyperparameter Configuration Card */}
          <div className="bg-white border border-[#DFE4DF] rounded-lg p-3 text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DFE4DF]">
              <div className="flex items-center gap-1.5 font-semibold text-[#202824]">
                <Sliders className="w-3.5 h-3.5 text-[#286B56]" />
                <span>Algorithm Hyperparameters</span>
              </div>
              <button
                onClick={() => {
                  setUseClahe(true);
                  setClaheClipLimit(2.0);
                  setClaheGridSize(8);
                  setGaussianDenoise(0.5);
                  setThresholdMethod('hysteresis');
                  setLowPercentile(75.0);
                  setHighPercentile(92.0);
                  setMinCompSize(25);
                  setFrangiScales([1.0, 1.5, 2.0, 3.0, 4.0]);
                }}
                className="text-[11px] text-[#69736D] hover:text-[#286B56] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {/* CLAHE Controls */}
            <div className="space-y-2 p-2.5 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#202824]">CLAHE Local Equalization</span>
                <input
                  type="checkbox"
                  checked={useClahe}
                  onChange={(e) => setUseClahe(e.target.checked)}
                  className="accent-[#286B56] cursor-pointer"
                />
              </div>

              {useClahe && (
                <>
                  <div className="flex items-center justify-between text-[11px] text-[#69736D]">
                    <span>Clip Limit: {claheClipLimit.toFixed(1)}</span>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.5"
                      value={claheClipLimit}
                      onChange={(e) => setClaheClipLimit(parseFloat(e.target.value))}
                      className="w-28 accent-[#286B56] cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#69736D]">
                    <span>Tile Grid Size: {claheGridSize}×{claheGridSize}</span>
                    <select
                      value={claheGridSize}
                      onChange={(e) => setClaheGridSize(parseInt(e.target.value))}
                      className="text-[11px] bg-white border border-[#DFE4DF] rounded px-1.5 py-0.5 text-[#202824]"
                    >
                      <option value="4">4 × 4</option>
                      <option value="8">8 × 8 (Default)</option>
                      <option value="16">16 × 16</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Multiscale Frangi Scales */}
            <div className="space-y-1.5 p-2.5 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <span className="font-medium text-[#202824] block">Frangi Vesselness Sigmas (σ)</span>
              <p className="text-[10px] text-[#69736D]">Multiscale Gaussian Hessian scales in pixels</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[1.0, 1.5, 2.0, 3.0, 4.0, 5.0].map((s) => {
                  const isChecked = frangiScales.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        if (isChecked && frangiScales.length > 1) {
                          setFrangiScales(frangiScales.filter((x) => x !== s));
                        } else if (!isChecked) {
                          setFrangiScales([...frangiScales, s].sort());
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-[#286B56] text-white border-[#286B56]'
                          : 'bg-white text-[#69736D] border-[#DFE4DF]'
                      }`}
                    >
                      σ={s.toFixed(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thresholding Strategy */}
            <div className="space-y-2 p-2.5 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#202824]">Binarization Method</span>
                <select
                  value={thresholdMethod}
                  onChange={(e) => setThresholdMethod(e.target.value as any)}
                  className="text-[11px] bg-white border border-[#DFE4DF] rounded px-1.5 py-0.5 text-[#202824]"
                >
                  <option value="hysteresis">Dual Hysteresis (Default)</option>
                  <option value="global_otsu">Global Otsu Threshold</option>
                  <option value="global_percentile">Global Percentile</option>
                </select>
              </div>

              {thresholdMethod === 'hysteresis' && (
                <div className="space-y-1 text-[11px] text-[#69736D]">
                  <div className="flex justify-between">
                    <span>Low Percentile: {lowPercentile}%</span>
                    <input
                      type="range"
                      min="50"
                      max="85"
                      value={lowPercentile}
                      onChange={(e) => setLowPercentile(parseFloat(e.target.value))}
                      className="w-28 accent-[#286B56] cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>High Percentile: {highPercentile}%</span>
                    <input
                      type="range"
                      min="85"
                      max="98"
                      value={highPercentile}
                      onChange={(e) => setHighPercentile(parseFloat(e.target.value))}
                      className="w-28 accent-[#286B56] cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Noise Pruning */}
            <div className="flex items-center justify-between p-2.5 bg-[#F5F6F4] rounded border border-[#DFE4DF] text-[11px]">
              <span className="text-[#69736D]">Min Connected Component:</span>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minCompSize}
                  onChange={(e) => setMinCompSize(parseInt(e.target.value) || 0)}
                  className="w-14 bg-white border border-[#DFE4DF] rounded px-1.5 py-0.5 text-[#202824] text-right"
                />
                <span className="text-[#69736D]">px</span>
              </div>
            </div>
          </div>

          {/* Results Summary & Telemetry (Only displayed when actual image is computed) */}
          {result ? (
            <div className="space-y-3">
              <MetricsBadge
                title="Vessel Segmentation Evaluation"
                metrics={result.ground_truth_metrics}
                vesselDensity={result.vessel_density}
              />

              <div className="bg-white border border-[#DFE4DF] rounded-lg p-3 text-xs space-y-1.5 font-mono">
                <span className="font-semibold font-sans text-[#202824] block pb-1 border-b border-[#DFE4DF]">
                  Spatial Density &amp; Binarization
                </span>
                <div className="flex justify-between text-[#69736D]">
                  <span>Vessel Pixels (FOV):</span>
                  <span className="text-[#202824] font-medium">{result.vessel_pixel_count.toLocaleString()} px</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Total FOV Pixels:</span>
                  <span className="text-[#202824] font-medium">{result.fov_pixel_count.toLocaleString()} px</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Vessel Density:</span>
                  <span className="text-[#286B56] font-semibold">{(result.vessel_density * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-[#69736D]">
                  <span>Binarization Details:</span>
                  <span className="text-[#202824] truncate max-w-[170px]">
                    {result.threshold_info.method} (H:{result.threshold_info.high_threshold ?? '—'})
                  </span>
                </div>
              </div>

              <ExecutionTimer telemetry={result.telemetry} />
            </div>
          ) : (
            <div className="bg-white border border-[#DFE4DF] rounded-lg p-4 text-xs text-[#69736D] space-y-1">
              <span className="font-semibold text-[#202824] block pb-1 border-b border-[#DFE4DF]">
                Measurements Ready
              </span>
              <p className="text-[11px] leading-relaxed pt-1">
                Upload a retinal fundus scan and click <span className="font-medium text-[#202824]">"Run Pipeline"</span> to compute multiscale Hessian vesselness and spatial vessel density.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
