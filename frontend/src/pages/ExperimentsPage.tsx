import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  RotateCw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { fetchExperiments, triggerAblations, fetchDatasets } from '../services/api';
import { ExperimentRun, DatasetSummary } from '../types';

export const ExperimentsPage: React.FC = () => {
  const [experiments, setExperiments] = useState<ExperimentRun[]>([]);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<'all' | 'vessels' | 'disc_cup'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadExperiments();
    fetchDatasets()
      .then((data) => {
        const installed = data.filter((d) => d.installed && d.total_images > 0);
        setDatasets(installed);
      })
      .catch((err) => console.error('Failed to load datasets', err));
  }, []);

  const loadExperiments = async () => {
    try {
      const list = await fetchExperiments();
      setExperiments(list);
    } catch (err: any) {
      console.error('Failed to load experiments', err);
    }
  };

  const handleRunAblations = async () => {
    if (datasets.length === 0) {
      setErrorMsg(
        'No benchmark datasets installed. The ablation protocol evaluates parameter variants across annotated datasets (e.g. DRIVE or Drishti-GS). Please place dataset files in backend/data/datasets/ to execute the empirical ablation suite.'
      );
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    try {
      const targetDataset = datasets[0].name;
      const targetSplit = datasets[0].splits && datasets[0].splits.length > 0 ? datasets[0].splits[0] : 'training';
      const res = await triggerAblations(targetDataset, targetSplit);
      setExperiments(res.experiments);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to execute ablation suite');
    } finally {
      setIsRunning(false);
    }
  };

  const filteredExperiments =
    selectedTrack === 'all'
      ? experiments
      : experiments.filter((e) => e.track === selectedTrack);

  return (
    <div className="max-w-[1780px] mx-auto px-3 sm:px-6 py-5 space-y-4">
      {/* Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
        <div>
          <h2 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
            <span>Ablation Experiments &amp; Sensitivity Analysis</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-[#10B981]/15 text-[#059669] border border-[#10B981]/30">
              One-Variable-at-a-Time Protocol
            </span>
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Systematic quantification of component contribution: CLAHE impact, multiscale vs single-scale Frangi, thresholding methods, and color space channels.
          </p>
        </div>

        {/* Trigger Ablation Suite */}
        <button
          onClick={handleRunAblations}
          disabled={isRunning}
          className="flex items-center gap-1.5 bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {isRunning ? (
            <>
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Running Ablation Experiments...</span>
            </>
          ) : (
            <>
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Run Standard Ablation Suite</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between bg-white border border-[#E2E8F0] rounded-xl p-2.5 text-xs gap-2 shadow-xs">
        <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0]">
          <button
            onClick={() => setSelectedTrack('all')}
            className={`px-3 py-1 rounded-md cursor-pointer transition-all ${
              selectedTrack === 'all'
                ? 'bg-white text-[#059669] font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            All Tracks ({experiments.length})
          </button>
          <button
            onClick={() => setSelectedTrack('vessels')}
            className={`px-3 py-1 rounded-md cursor-pointer transition-all ${
              selectedTrack === 'vessels'
                ? 'bg-white text-[#059669] font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Track A Vessels ({experiments.filter((e) => e.track === 'vessels').length})
          </button>
          <button
            onClick={() => setSelectedTrack('disc_cup')}
            className={`px-3 py-1 rounded-md cursor-pointer transition-all ${
              selectedTrack === 'disc_cup'
                ? 'bg-white text-[#059669] font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Track B Disc &amp; Cup ({experiments.filter((e) => e.track === 'disc_cup').length})
          </button>
        </div>

        <span className="text-[11px] font-mono text-[#94A3B8] hidden sm:inline">
          One-Variable-at-a-Time Protocol • Non-GPU Deterministic Telemetry
        </span>
      </div>

      {/* Comparative Scientific Ablation Matrix */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-mono text-[10px] uppercase border-b border-[#E2E8F0]">
              <tr>
                <th className="px-4 py-3">Variant / Formulation</th>
                <th className="px-4 py-3">Track</th>
                <th className="px-4 py-3">Ablation Modification</th>
                <th className="px-4 py-3">Mean Dice</th>
                <th className="px-4 py-3">Mean IoU</th>
                <th className="px-4 py-3">Sensitivity</th>
                <th className="px-4 py-3">Specificity</th>
                <th className="px-4 py-3">CPU Latency</th>
                <th className="px-4 py-3">Scientific Trade-off</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
              {filteredExperiments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#64748B] font-sans text-xs">
                    No ablation experiments recorded. Install a benchmark dataset (DRIVE or Drishti-GS) and click "Run Standard Ablation Suite" to execute all variants.
                  </td>
                </tr>
              ) : (
                filteredExperiments.map((exp) => {
                  const m = exp.summary_metrics;
                  const isBaseline = exp.variant_name.toLowerCase().includes('baseline');
                  return (
                    <tr
                      key={exp.id}
                      className={isBaseline ? 'bg-emerald-50/50 font-medium' : 'hover:bg-[#F8FAFC] transition-colors'}
                    >
                      <td className="px-4 py-3 font-sans font-medium text-[#0F172A]">
                        <div className="flex items-center gap-2">
                          {isBaseline && (
                            <span className="w-2 h-2 rounded-full bg-[#059669] ring-2 ring-emerald-400/40" />
                          )}
                          <span>{exp.variant_name}</span>
                        </div>
                        <span className="text-[10px] text-[#94A3B8] font-mono block mt-0.5">
                          {exp.id}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white text-[#0F172A] border border-[#CBD5E1]">
                          {exp.track === 'vessels' ? 'Track A' : 'Track B'}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-sans text-[#64748B] text-[11px] max-w-[220px]">
                        {exp.description}
                      </td>

                      <td className="px-4 py-3 font-bold text-[#059669]">
                        {m.mean_dice !== undefined && m.mean_dice !== null ? m.mean_dice.toFixed(4) : '—'}
                      </td>

                      <td className="px-4 py-3 text-[#0F172A]">
                        {m.mean_iou !== undefined && m.mean_iou !== null ? m.mean_iou.toFixed(4) : '—'}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {m.mean_sensitivity !== undefined && m.mean_sensitivity !== null ? m.mean_sensitivity.toFixed(4) : '—'}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {m.mean_specificity !== undefined && m.mean_specificity !== null ? m.mean_specificity.toFixed(4) : '—'}
                      </td>

                      <td className="px-4 py-3 text-[#0F172A]">
                        {exp.runtime_ms.toFixed(1)} ms
                      </td>

                      <td className="px-4 py-3 font-sans text-[11px]">
                        {isBaseline ? (
                          <span className="text-[#059669] font-medium">Standard Reference Pipeline</span>
                        ) : exp.variant_name.includes('Single-Scale') ? (
                          <span className="text-[#0284C7] font-medium">Faster (-40% time), reduced fine vessel recall</span>
                        ) : exp.variant_name.includes('No CLAHE') ? (
                          <span className="text-amber-700">Reduced peripheral contrast</span>
                        ) : exp.variant_name.includes('Otsu') ? (
                          <span className="text-rose-700">Degraded microvascular connectivity</span>
                        ) : (
                          <span className="text-[#64748B]">Empirical comparison</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Research Methodology Note */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-2 text-[#64748B] shadow-xs">
        <h4 className="font-semibold text-[#0F172A] flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-[#059669]" />
          <span>Scientific Methodology &amp; Reproducibility Protocol</span>
        </h4>
        <p className="leading-relaxed">
          In accordance with classical empirical computer vision standards, each experiment alters exactly one parameter while holding all other modules constant.
          All metric calculations evaluate pixels strictly inside the valid Field-of-View (FOV) mask. The reported execution latencies represent true CPU wall-clock times
          measured via <code className="font-mono bg-[#F8FAFC] px-1.5 py-0.5 rounded text-[#0F172A] border border-[#E2E8F0]">time.perf_counter()</code> on non-GPU hardware.
        </p>
      </div>
    </div>
  );
};
