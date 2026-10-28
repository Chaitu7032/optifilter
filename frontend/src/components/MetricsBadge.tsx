import React from 'react';
import { SegmentationMetrics } from '../types';
import { useWorkstationMode } from '../context/WorkstationContext';
import { CheckCircle2, Info } from 'lucide-react';

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
  const { isClinic } = useWorkstationMode();

  if (!metrics && vcdr === undefined && vesselDensity === undefined) {
    return null;
  }

  return (
    <div className={`bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-3 shadow-xs ${className}`}>
      {title && (
        <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
          <h4 className="font-semibold text-[#0F172A] flex items-center gap-1.5">
            <span>{title}</span>
          </h4>
          <span className="text-[10px] text-[#64748B] font-mono bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
            Strict FOV-Masked
          </span>
        </div>
      )}

      {/* Direct Image Morphometric Measurements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {vesselDensity !== undefined && vesselDensity !== null && (
          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#10B981]/30">
            <div className="text-[10px] text-[#059669] font-semibold uppercase tracking-wider">
              Computed Vessel Density
            </div>
            <div className="font-mono font-bold text-lg text-[#0F172A] mt-0.5">
              {(vesselDensity * 100).toFixed(2)}%
            </div>
            <div className="text-[10px] text-[#64748B] mt-0.5">
              Vessel pixels / FOV pixels
            </div>
          </div>
        )}

        {vcdr !== undefined && vcdr !== null && (
          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#0EA5E9]/30">
            <div className="text-[10px] text-[#0284C7] font-semibold uppercase tracking-wider">
              Computed Vertical CDR
            </div>
            <div className="font-mono font-bold text-lg text-[#0F172A] mt-0.5">
              {vcdr.toFixed(4)}
            </div>
            <div className="text-[10px] text-[#64748B] mt-0.5">
              Cup height / Disc height
            </div>
          </div>
        )}

        {cdrError !== undefined && cdrError !== null && (
          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <div className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">
              vCDR Absolute Error
            </div>
            <div className="font-mono font-bold text-lg text-[#0F172A] mt-0.5">
              {cdrError.toFixed(4)}
            </div>
            <div className="text-[10px] text-[#64748B] mt-0.5">
              |Predicted - Ground Truth|
            </div>
          </div>
        )}
      </div>

      {/* Ground-Truth Evaluation Section */}
      <div className="space-y-2 pt-1">
        {metrics ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#0F172A] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                <span>Reference Mask Agreement</span>
              </span>
              <span className="text-[10px] font-mono text-[#059669] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                Ground Truth Evaluated
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <div className="text-[10px] text-[#64748B]">Dice Coefficient (F1)</div>
                <div className="font-mono font-bold text-sm text-[#059669] mt-0.5">
                  {metrics.dice.toFixed(4)}
                </div>
              </div>

              <div className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <div className="text-[10px] text-[#64748B]">IoU (Jaccard Index)</div>
                <div className="font-mono font-bold text-sm text-[#0F172A] mt-0.5">
                  {metrics.iou.toFixed(4)}
                </div>
              </div>

              <div className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <div className="text-[10px] text-[#64748B]">Sensitivity (Recall)</div>
                <div className="font-mono font-bold text-sm text-[#0F172A] mt-0.5">
                  {metrics.sensitivity.toFixed(4)}
                </div>
              </div>

              <div className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <div className="text-[10px] text-[#64748B]">Specificity (TNR)</div>
                <div className="font-mono font-bold text-sm text-[#0F172A] mt-0.5">
                  {metrics.specificity.toFixed(4)}
                </div>
              </div>

              <div className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <div className="text-[10px] text-[#64748B]">Precision (PPV)</div>
                <div className="font-mono font-bold text-sm text-[#0F172A] mt-0.5">
                  {metrics.precision.toFixed(4)}
                </div>
              </div>

              <div className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <div className="text-[10px] text-[#64748B]">Accuracy</div>
                <div className="font-mono font-bold text-sm text-[#0F172A] mt-0.5">
                  {metrics.accuracy.toFixed(4)}
                </div>
              </div>
            </div>

            {/* Confusion Matrix Breakdown in Clinic Mode */}
            {isClinic && (
              <div className="mt-3 p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] space-y-1 font-mono text-[11px]">
                <div className="text-[#0F172A] font-sans font-semibold text-[10px] uppercase pb-1 border-b border-[#E2E8F0]">
                  Pixel-Level Confusion Matrix (within FOV)
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[#475569]">
                  <div className="flex justify-between">
                    <span>True Positives (TP):</span>
                    <span className="text-[#0F172A] font-semibold">{metrics.tp.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>False Positives (FP):</span>
                    <span className="text-amber-700 font-semibold">{metrics.fp.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>False Negatives (FN):</span>
                    <span className="text-rose-700 font-semibold">{metrics.fn.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>True Negatives (TN):</span>
                    <span className="text-[#0F172A] font-semibold">{metrics.tn.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-[#0F172A] font-semibold">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>Reference Accuracy Status</span>
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white text-[#64748B] border border-[#CBD5E1]">
                Inference Only
              </span>
            </div>
            <p className="text-[10px] text-[#64748B] leading-relaxed">
              Reference annotations unavailable — accuracy not evaluated. Quantitative metrics (Dice, IoU, Sensitivity, Specificity) require an expert ground-truth manual mask. Values are strictly withheld rather than displaying misleading zeroes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
