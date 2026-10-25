import {
  VesselAnalysisResult,
  DiscCupAnalysisResult,
  DatasetSummary,
  BenchmarkRun,
  ExperimentRun,
} from '../types';

const BASE_URL = '/api/v1';

export async function fetchHealth(): Promise<any> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchDatasets(): Promise<DatasetSummary[]> {
  const res = await fetch(`${BASE_URL}/benchmarks/datasets`);
  if (!res.ok) throw new Error(`Failed to load datasets: ${res.statusText}`);
  return res.json();
}

export async function inspectImage(formData: FormData): Promise<any> {
  const res = await fetch(`${BASE_URL}/analysis/inspect`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Inspection failed');
  }
  return res.json();
}

export async function runVesselAnalysis(formData: FormData): Promise<VesselAnalysisResult> {
  const res = await fetch(`${BASE_URL}/analysis/vessels`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Vessel analysis failed');
  }
  return res.json();
}

export async function runDiscCupAnalysis(formData: FormData): Promise<DiscCupAnalysisResult> {
  const res = await fetch(`${BASE_URL}/analysis/disc-cup`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Disc/Cup analysis failed');
  }
  return res.json();
}

export async function fetchBenchmarks(): Promise<BenchmarkRun[]> {
  const res = await fetch(`${BASE_URL}/benchmarks`);
  if (!res.ok) throw new Error(`Failed to load benchmarks: ${res.statusText}`);
  return res.json();
}

export async function fetchBenchmarkDetails(runId: string): Promise<BenchmarkRun> {
  const res = await fetch(`${BASE_URL}/benchmarks/${runId}`);
  if (!res.ok) throw new Error(`Failed to load benchmark ${runId}: ${res.statusText}`);
  return res.json();
}

export async function startBenchmark(payload: {
  dataset_name: string;
  split: string;
  track: 'vessels' | 'disc_cup';
  custom_params?: Record<string, any>;
  run_name?: string;
}): Promise<BenchmarkRun> {
  const res = await fetch(`${BASE_URL}/benchmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Benchmark execution failed');
  }
  return res.json();
}

export async function fetchExperiments(): Promise<ExperimentRun[]> {
  const res = await fetch(`${BASE_URL}/experiments`);
  if (!res.ok) throw new Error(`Failed to load experiments: ${res.statusText}`);
  return res.json();
}

export async function triggerAblations(dataset_name: string = 'DRIVE', split: string = 'training'): Promise<any> {
  const res = await fetch(`${BASE_URL}/experiments/run-ablations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_name, split }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Ablation execution failed');
  }
  return res.json();
}

export function getExportCsvUrl(runId: string): string {
  return `${BASE_URL}/exports/csv/${runId}`;
}

export function getExportJsonUrl(runId: string): string {
  return `${BASE_URL}/exports/json/${runId}`;
}
