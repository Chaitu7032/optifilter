export interface ImageMetadata {
  height: number;
  width: number;
  channels: number;
  dtype: string;
  aspect_ratio: number;
}

export interface SegmentationMetrics {
  dice: number;
  iou: number;
  sensitivity: number;
  specificity: number;
  precision: number;
  fpr: number;
  accuracy: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export interface PipelineTelemetry {
  total_ms: number;
  stages_ms: Record<string, number>;
  memory_delta_mb: number;
  peak_memory_mb: number;
  under_two_seconds: boolean;
  system_info: Record<string, string>;
}

export interface VesselAnalysisResult {
  success: boolean;
  image_metadata: ImageMetadata;
  is_fov_estimated: boolean;
  fov_pixel_count: number;
  vessel_pixel_count: number;
  vessel_density: number;
  dr_status?: string;
  dr_assessment?: {
    status: string;
    risk_level: 'nominal' | 'low_density' | 'high_density' | 'low' | 'moderate' | 'high' | string;
    vessel_density_pct: number;
    description: string;
    threshold_used: string;
    disclaimer?: string;
  };
  threshold_info: Record<string, any>;
  parameters: Record<string, any>;
  telemetry: PipelineTelemetry;
  intermediate_images: {
    original?: string;
    green_channel?: string;
    clahe_enhanced?: string;
    fov_mask?: string;
    frangi_heatmap?: string;
    binary_mask?: string;
    overlay?: string;
  };
  ground_truth_metrics?: SegmentationMetrics | null;
}

export interface DiscCupAnalysisResult {
  success: boolean;
  outcome_status?: 'SUCCESS' | 'WARNING' | 'FALLBACK' | 'FAILED' | string;
  localization_checks?: Record<string, any>;
  image_metadata: ImageMetadata;
  is_fov_estimated: boolean;
  disc_center: { x: number; y: number };
  disc_diameter_vertical_px: number;
  cup_diameter_vertical_px: number;
  disc_area_px: number;
  cup_area_px: number;
  vertical_cdr: number | null;
  glaucoma_status?: string;
  glaucoma_assessment?: {
    status: string;
    risk_level: 'nominal' | 'borderline' | 'elevated' | 'low' | 'moderate' | 'high' | 'unknown' | string;
    description: string;
    threshold_used: string;
    disclaimer?: string;
  };
  warnings: string[];
  telemetry: PipelineTelemetry;
  disc_metrics?: SegmentationMetrics | null;
  cup_metrics?: SegmentationMetrics | null;
  cdr_absolute_error?: number | null;
  disc_contour_pts: number[][];
  cup_contour_pts: number[][];
  intermediate_images: {
    original?: string;
    fov_mask?: string;
    smoothed_response?: string;
    disc_mask?: string;
    cup_mask?: string;
    overlay?: string;
  };
}

export interface DatasetItemPreview {
  id: string;
  split: string;
}

export interface DatasetSummary {
  name: string;
  installed: boolean;
  total_images: number;
  splits: string[];
  items: DatasetItemPreview[];
}

export interface BenchmarkRun {
  id: string;
  name: string;
  dataset: string;
  split: string;
  track: 'vessels' | 'disc_cup';
  status: string;
  created_at: string;
  num_images: number;
  mean_dice: number | null;
  mean_iou: number | null;
  mean_sensitivity: number | null;
  mean_specificity: number | null;
  mean_precision: number | null;
  mean_cdr_error: number | null;
  mean_runtime_ms: number;
  median_runtime_ms: number;
  parameters: Record<string, any>;
  per_image_results: Array<{
    item_id: string;
    runtime_ms: number;
    metrics?: SegmentationMetrics;
    vessel_density?: number;
    vcdr?: number | null;
    cdr_absolute_error?: number | null;
    disc_metrics?: SegmentationMetrics;
    cup_metrics?: SegmentationMetrics;
  }>;
  telemetry: {
    num_evaluated: number;
    under_two_seconds: boolean;
    images_per_second: number;
  };
}

export interface ExperimentRun {
  id: string;
  name: string;
  track: 'vessels' | 'disc_cup';
  variant_name: string;
  description: string;
  dataset: string;
  status: string;
  created_at: string;
  parameters: Record<string, any>;
  summary_metrics: Record<string, number>;
  runtime_ms: number;
}
