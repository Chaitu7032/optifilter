import React from 'react';
import { SegmentationMetrics } from '../types';

interface MetricsBadgeProps {
  metrics?: SegmentationMetrics | null;
  vcdr?: number | null;
  cdrError?: number | null;
  vesselDensity?: number | null;
  title?: string;
  className?: string;
}

export const MetricsBadge: React.FC<MetricsBadgeProps> = ({
  metrics,
  vcdr,
  cdrError,
  vesselDensity,
  title,
  className = '',
}) => {
  if (!metrics && vcdr === undefined && vesselDensity === undefined) {
    return null;
  }

  return (
    <div className={`bg-white border border-[#DFE4DF] rounded-lg p-3 text-xs ${className}`}>
      {title && (
        <h4 className="font-semibold text-[#202824] mb-2 flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[10px] text-[#69736D] font-normal font-mono">FOV-masked</span>
        </h4>
      )}

      <div className="space-y-2">
        {metrics ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-2 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <div className="text-[10px] text-[#69736D]">Dice (F1)</div>
              <div className="font-mono font-semibold text-sm text-[#286B56]">
                {metrics.dice.toFixed(4)}
              </div>
            </div>
            <div className="p-2 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <div className="text-[10px] text-[#69736D]">IoU (Jaccard)</div>
              <div className="font-mono font-semibold text-sm text-[#202824]">
                {metrics.iou.toFixed(4)}
              </div>
            </div>
            <div className="p-2 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <div className="text-[10px] text-[#69736D]">Sensitivity (Recall)</div>
              <div className="font-mono font-semibold text-sm text-[#202824]">
                {metrics.sensitivity.toFixed(4)}
              </div>
            </div>
            <div className="p-2 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <div className="text-[10px] text-[#69736D]">Specificity</div>
              <div className="font-mono font-semibold text-sm text-[#202824]">
                {metrics.specificity.toFixed(4)}
              </div>
            </div>
            <div className="p-2 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <div className="text-[10px] text-[#69736D]">Precision (PPV)</div>
              <div className="font-mono font-semibold text-sm text-[#202824]">
                {metrics.precision.toFixed(4)}
              </div>
            </div>
            <div className="p-2 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <div className="text-[10px] text-[#69736D]">Accuracy</div>
              <div className="font-mono font-semibold text-sm text-[#202824]">
                {metrics.accuracy.toFixed(4)}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-[#F5F6F4] rounded border border-[#DFE4DF] text-[11px] text-[#69736D] space-y-1">
            <div className="flex items-center justify-between font-semibold text-[#202824]">
              <span>Ground-Truth Metrics</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-[#69736D] border border-[#DFE4DF]">
                Unavailable (No Reference Mask)
              </span>
            </div>
            <p className="text-[10px] text-[#69736D] leading-tight">
              Evaluation metrics (Dice, IoU, Sensitivity, Specificity) require an expert ground-truth manual mask. Values are strictly withheld rather than simulated or zeroed.
            </p>
          </div>
        )}

        {/* Computed direct measurements from image pixels */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {vesselDensity !== undefined && vesselDensity !== null && (
            <div className="p-2 bg-[#DCEBE3] rounded border border-[#286B56]/30">
              <div className="text-[10px] text-[#286B56] font-medium">Computed Vessel Density</div>
              <div className="font-mono font-semibold text-sm text-[#286B56]">
                {(vesselDensity * 100).toFixed(2)}%
              </div>
            </div>
          )}

          {vcdr !== undefined && vcdr !== null && (
            <div className="p-2 bg-[#DCEBE3] rounded border border-[#286B56]/30">
              <div className="text-[10px] text-[#286B56] font-medium">Computed Vertical CDR</div>
              <div className="font-mono font-semibold text-sm text-[#286B56]">
                {vcdr.toFixed(4)}
              </div>
            </div>
          )}

          {cdrError !== undefined && cdrError !== null && (
            <div className="p-2 bg-[#F5F6F4] rounded border border-[#DFE4DF]">
              <div className="text-[10px] text-[#69736D]">vCDR Absolute Error</div>
              <div className="font-mono font-semibold text-sm text-[#202824]">
                {cdrError.toFixed(4)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
