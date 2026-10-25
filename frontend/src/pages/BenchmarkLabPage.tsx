import React, { useState, useEffect } from 'react';
import {
  Database,
  Play,
  RotateCw,
  Download,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  FileCode,
  Table,
  BarChart2,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import {
  fetchDatasets,
  fetchBenchmarks,
  startBenchmark,
  getExportCsvUrl,
  getExportJsonUrl,
} from '../services/api';
import { DatasetSummary, BenchmarkRun } from '../types';

export const BenchmarkLabPage: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedSplit, setSelectedSplit] = useState<string>('training');
  const [selectedTrack, setSelectedTrack] = useState<'vessels' | 'disc_cup'>('vessels');
  const [runName, setRunName] = useState('');

  // Runs History (Clean state - 0 preloaded fake runs)
  const [benchmarks, setBenchmarks] = useState<BenchmarkRun[]>([]);
  const [activeRun, setActiveRun] = useState<BenchmarkRun | null>(null);

  // Loading & error
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dsList = await fetchDatasets();
      const installed = dsList.filter((d) => d.installed && d.total_images > 0);
      setDatasets(installed);
      if (installed.length > 0) {
        setSelectedDataset(installed[0].name);
        if (installed[0].splits && installed[0].splits.length > 0) {
          setSelectedSplit(installed[0].splits[0]);
        }
      }

      const bList = await fetchBenchmarks();
      setBenchmarks(bList);
      if (bList.length > 0 && !activeRun) {
        setActiveRun(bList[0]);
      }
    } catch (err: any) {
      console.error('Failed to load benchmark data', err);
    }
  };

  const handleStartBenchmark = async () => {
    if (!selectedDataset) {
      setErrorMsg('Please select an installed benchmark dataset to execute.');
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    try {
      const newRun = await startBenchmark({
        dataset_name: selectedDataset,
        split: selectedSplit,
        track: selectedTrack,
        run_name: runName.trim() || undefined,
      });

      // Refresh real recorded benchmarks
      const updatedList = await fetchBenchmarks();
      setBenchmarks(updatedList);
      setActiveRun(newRun);
      setRunName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Benchmark execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const currentDatasetObj = datasets.find((d) => d.name === selectedDataset);
  const hasInstalledDatasets = datasets.length > 0;

  return (
    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DFE4DF]">
        <div>
          <h2 className="text-base font-semibold text-[#202824] flex items-center gap-2">
            <span>Benchmark Laboratory &amp; Dataset Validation</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-[#DCEBE3] text-[#286B56]">
              Quantitative Scientific Evaluation
            </span>
          </h2>
          <p className="text-xs text-[#69736D] mt-0.5">
            Automated batch benchmarking with ground-truth verification, FOV masking, and reproducible CSV/JSON export.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeRun && (
            <>
              <a
                href={getExportCsvUrl(activeRun.id)}
                download
                className="flex items-center gap-1.5 text-xs bg-white hover:bg-[#F5F6F4] text-[#202824] border border-[#DFE4DF] rounded px-3 py-1.5 font-medium transition-colors"
                title="Download per-image evaluations CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#286B56]" />
                <span>Export CSV</span>
              </a>
              <a
                href={getExportJsonUrl(activeRun.id)}
                download
                className="flex items-center gap-1.5 text-xs bg-white hover:bg-[#F5F6F4] text-[#202824] border border-[#DFE4DF] rounded px-3 py-1.5 font-medium transition-colors"
                title="Download run JSON metadata"
              >
                <FileCode className="w-3.5 h-3.5 text-[#286B56]" />
                <span>Export JSON</span>
              </a>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-xs text-[#B54747] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Execution Launcher Bar */}
      {hasInstalledDatasets ? (
        <div className="bg-white border border-[#DFE4DF] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <Database className="w-4 h-4 text-[#286B56]" />
              <span className="font-semibold text-[#202824]">Target Dataset:</span>
            </div>

            <select
              value={selectedDataset}
              onChange={(e) => {
                setSelectedDataset(e.target.value);
                const ds = datasets.find((d) => d.name === e.target.value);
                if (ds && ds.splits.length > 0) setSelectedSplit(ds.splits[0]);
              }}
              className="text-xs bg-[#F5F6F4] border border-[#DFE4DF] rounded-md px-2.5 py-1.5 text-[#202824]"
            >
              {datasets.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.total_images} scans)
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#69736D]">Split Manifest:</span>
              <select
                value={selectedSplit}
                onChange={(e) => setSelectedSplit(e.target.value)}
                className="text-xs bg-[#F5F6F4] border border-[#DFE4DF] rounded-md px-2.5 py-1.5 font-mono text-[#202824]"
              >
                {currentDatasetObj?.splits.map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()} Split
                  </option>
                )) || <option value="all">ALL</option>}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#69736D]">Track:</span>
              <select
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(e.target.value as any)}
                className="text-xs bg-[#F5F6F4] border border-[#DFE4DF] rounded-md px-2.5 py-1.5 text-[#202824]"
              >
                <option value="vessels">Track A (Vessels)</option>
                <option value="disc_cup">Track B (Disc &amp; Cup)</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Custom Run Label (Optional)"
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              className="text-xs bg-[#F5F6F4] border border-[#DFE4DF] rounded-md px-2.5 py-1.5 text-[#202824] placeholder:text-[#A6B4A8] w-48"
            />
          </div>

          <button
            onClick={handleStartBenchmark}
            disabled={isRunning}
            className="flex items-center gap-1.5 bg-[#286B56] hover:bg-[#205746] disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-md shadow-xs cursor-pointer transition-colors"
          >
            {isRunning ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating Dataset...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Benchmark</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#DFE4DF] rounded-lg p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-[#202824]">
            <FolderOpen className="w-4 h-4 text-[#286B56]" />
            <span>No External Benchmark Datasets Installed</span>
          </div>
          <p className="text-[#69736D] leading-relaxed">
            Batch benchmarking requires a standard research dataset with ground-truth manual annotations (e.g. <span className="font-medium text-[#202824]">DRIVE</span> or <span className="font-medium text-[#202824]">Drishti-GS</span>).
            To run batch evaluations, place the datasets into <code className="font-mono bg-[#F5F6F4] px-1 py-0.5 rounded text-[#202824]">backend/data/datasets/</code> as outlined in the Documentation.
          </p>
          <p className="text-[11px] text-[#69736D]">
            Individual fundus scans can be analyzed directly on the <span className="font-medium text-[#202824]">Image Workspace</span> page without external datasets.
          </p>
        </div>
      )}

      {/* Main Content: History Sidebar + Active Benchmark Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 4 Cols: Benchmark Run History */}
        <div className="lg:col-span-4 bg-white border border-[#DFE4DF] rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DFE4DF]">
            <span className="font-semibold text-xs text-[#202824]">Execution History</span>
            <span className="text-[11px] font-mono text-[#69736D]">
              {benchmarks.length} runs recorded
            </span>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {benchmarks.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#69736D] space-y-1">
                <Database className="w-6 h-6 mx-auto opacity-30 text-[#A6B4A8]" />
                <p className="font-medium text-[#202824]">No Benchmark Runs Recorded</p>
                <p className="text-[11px]">Install a dataset to execute automated batch evaluations.</p>
              </div>
            ) : (
              benchmarks.map((run) => {
                const isSelected = activeRun?.id === run.id;
                return (
                  <div
                    key={run.id}
                    onClick={() => setActiveRun(run)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#286B56] bg-[#DCEBE3]/30 shadow-xs'
                        : 'border-[#DFE4DF] bg-[#F5F6F4] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-[#202824] truncate max-w-[190px]">
                        {run.name}
                      </span>
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-white text-[#286B56] border border-[#DFE4DF]">
                        {run.track}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[#69736D]">
                      <span>{run.dataset} [{run.split}]</span>
                      <span>{run.num_images} scans</span>
                    </div>

                    <div className="mt-1 pt-1 border-t border-[#DFE4DF]/60 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[#286B56] font-semibold">
                        {run.mean_dice ? `Dice: ${run.mean_dice.toFixed(4)}` : 'Dice: —'}
                      </span>
                      <span className="text-[#69736D]">
                        {run.mean_runtime_ms.toFixed(1)} ms/img
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 8 Cols: Detailed Benchmark Metrics & Per-Image Table */}
        <div className="lg:col-span-8 space-y-4">
          {activeRun ? (
            <>
              {/* Aggregate KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white border border-[#DFE4DF] rounded-lg p-3">
                  <div className="text-[10px] text-[#69736D] uppercase tracking-wider font-semibold">Mean Dice (F1)</div>
                  <div className="font-mono text-xl font-bold text-[#286B56] mt-0.5">
                    {activeRun.mean_dice !== null && activeRun.mean_dice !== undefined ? activeRun.mean_dice.toFixed(4) : '—'}
                  </div>
                  <div className="text-[10px] text-[#69736D] mt-0.5">Overlap in FOV</div>
                </div>

                <div className="bg-white border border-[#DFE4DF] rounded-lg p-3">
                  <div className="text-[10px] text-[#69736D] uppercase tracking-wider font-semibold">Mean IoU (Jaccard)</div>
                  <div className="font-mono text-xl font-bold text-[#202824] mt-0.5">
                    {activeRun.mean_iou !== null && activeRun.mean_iou !== undefined ? activeRun.mean_iou.toFixed(4) : '—'}
                  </div>
                  <div className="text-[10px] text-[#69736D] mt-0.5">Intersection / Union</div>
                </div>

                <div className="bg-white border border-[#DFE4DF] rounded-lg p-3">
                  <div className="text-[10px] text-[#69736D] uppercase tracking-wider font-semibold">Mean CPU Latency</div>
                  <div className="font-mono text-xl font-bold text-[#202824] mt-0.5">
                    {activeRun.mean_runtime_ms.toFixed(1)} ms
                  </div>
                  <div className="text-[10px] text-[#286B56] font-medium mt-0.5">
                    {activeRun.telemetry?.under_two_seconds ? '✓ Under 2.0s Target' : 'Exceeds budget'}
                  </div>
                </div>

                <div className="bg-white border border-[#DFE4DF] rounded-lg p-3">
                  <div className="text-[10px] text-[#69736D] uppercase tracking-wider font-semibold">Throughput</div>
                  <div className="font-mono text-xl font-bold text-[#202824] mt-0.5">
                    {activeRun.telemetry?.images_per_second || (1000 / (activeRun.mean_runtime_ms || 1)).toFixed(1)}
                  </div>
                  <div className="text-[10px] text-[#69736D] mt-0.5">Images / Second (CPU)</div>
                </div>
              </div>

              {/* Per-Image Quantitative Evaluation Table */}
              <div className="bg-white border border-[#DFE4DF] rounded-lg overflow-hidden shadow-2xs">
                <div className="px-4 py-3 border-b border-[#DFE4DF] bg-[#F5F6F4] flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#202824]">
                    Per-Scan Evaluation Record ({activeRun.per_image_results?.length || 0} evaluated)
                  </span>
                  <span className="text-[11px] font-mono text-[#69736D]">
                    ID: {activeRun.id}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F5F6F4] text-[#69736D] font-mono text-[10px] uppercase border-b border-[#DFE4DF] sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Scan ID</th>
                        <th className="px-3 py-2">CPU Time</th>
                        {activeRun.track === 'vessels' ? (
                          <>
                            <th className="px-3 py-2">Dice</th>
                            <th className="px-3 py-2">IoU</th>
                            <th className="px-3 py-2">Sensitivity</th>
                            <th className="px-3 py-2">Specificity</th>
                            <th className="px-3 py-2">Vessel Density</th>
                          </>
                        ) : (
                          <>
                            <th className="px-3 py-2">Vertical CDR</th>
                            <th className="px-3 py-2">CDR Error</th>
                            <th className="px-3 py-2">Disc Dice</th>
                            <th className="px-3 py-2">Disc IoU</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE4DF] font-mono text-[11px]">
                      {activeRun.per_image_results?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#F5F6F4]/60">
                          <td className="px-3 py-2 font-medium text-[#202824]">{row.item_id}</td>
                          <td className="px-3 py-2 text-[#69736D]">{row.runtime_ms.toFixed(1)} ms</td>
                          {activeRun.track === 'vessels' ? (
                            <>
                              <td className="px-3 py-2 text-[#286B56] font-semibold">
                                {row.metrics?.dice !== undefined && row.metrics?.dice !== null ? row.metrics.dice.toFixed(4) : '—'}
                              </td>
                              <td className="px-3 py-2 text-[#202824]">
                                {row.metrics?.iou !== undefined && row.metrics?.iou !== null ? row.metrics.iou.toFixed(4) : '—'}
                              </td>
                              <td className="px-3 py-2 text-[#69736D]">
                                {row.metrics?.sensitivity !== undefined && row.metrics?.sensitivity !== null ? row.metrics.sensitivity.toFixed(4) : '—'}
                              </td>
                              <td className="px-3 py-2 text-[#69736D]">
                                {row.metrics?.specificity !== undefined && row.metrics?.specificity !== null ? row.metrics.specificity.toFixed(4) : '—'}
                              </td>
                              <td className="px-3 py-2 text-[#202824]">
                                {row.vessel_density !== undefined && row.vessel_density !== null ? `${(row.vessel_density * 100).toFixed(2)}%` : '—'}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 text-[#286B56] font-semibold">
                                {row.vcdr !== undefined && row.vcdr !== null ? row.vcdr.toFixed(4) : '—'}
                              </td>
                              <td className="px-3 py-2 text-[#202824]">
                                {row.cdr_absolute_error !== undefined && row.cdr_absolute_error !== null
                                  ? row.cdr_absolute_error.toFixed(4)
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 text-[#69736D]">
                                {row.disc_metrics?.dice !== undefined && row.disc_metrics?.dice !== null ? row.disc_metrics.dice.toFixed(4) : '—'}
                              </td>
                              <td className="px-3 py-2 text-[#69736D]">
                                {row.disc_metrics?.iou !== undefined && row.disc_metrics?.iou !== null ? row.disc_metrics.iou.toFixed(4) : '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-[#DFE4DF] rounded-lg p-12 text-center text-xs text-[#69736D]">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#A6B4A8]" />
              <p className="font-semibold text-[#202824]">No Benchmark Run Selected</p>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                {hasInstalledDatasets
                  ? 'Select an installed dataset above and click "Execute Benchmark" to record real per-scan evaluations.'
                  : 'Install DRIVE or Drishti-GS to execute quantitative dataset benchmarks.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
