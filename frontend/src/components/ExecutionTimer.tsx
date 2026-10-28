import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';
import { PipelineTelemetry } from '../types';

interface ExecutionTimerProps {
  telemetry?: PipelineTelemetry | null;
  className?: string;
}

export const ExecutionTimer: React.FC<ExecutionTimerProps> = ({
  telemetry,
  className = '',
}) => {
  if (!telemetry) return null;

  const isUnder2s = telemetry.total_ms < 2000.0;

  return (
    <div className={`bg-white border border-[#E2E8F0] rounded-xl p-4 text-xs shadow-xs ${className}`}>
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
          <Clock className="w-3.5 h-3.5 text-[#059669]" />
          <span>CPU Latency Profile</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-base font-bold text-[#0F172A]">
            {telemetry.total_ms.toFixed(1)} ms
          </span>
          {isUnder2s ? (
            <span className="flex items-center text-[10px] text-[#059669] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
              <CheckCircle2 className="w-3 h-3 mr-1" /> &lt;2s Target
            </span>
          ) : (
            <span className="flex items-center text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
              <AlertCircle className="w-3 h-3 mr-1" /> &gt;2s
            </span>
          )}
        </div>
      </div>

      {/* Sub-stages latency breakdown */}
      {telemetry.stages_ms && Object.keys(telemetry.stages_ms).length > 0 && (
        <div className="space-y-1.5 font-mono text-[11px]">
          {Object.entries(telemetry.stages_ms).map(([stage, ms]) => {
            const pct = Math.min(100, Math.round((Number(ms) / telemetry.total_ms) * 100));
            return (
              <div key={stage} className="flex items-center justify-between text-[#64748B]">
                <span className="capitalize">{stage.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden border border-[#E2E8F0]">
                    <div
                      className="h-full bg-gradient-to-r from-[#059669] to-[#10B981]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[#0F172A] font-medium w-14 text-right">
                    {Number(ms).toFixed(1)} ms
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Host Memory Footprint */}
      {telemetry.peak_memory_mb !== undefined && (
        <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex justify-between text-[11px] font-mono text-[#64748B]">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-[#0284C7]" />
            <span>Peak RSS Memory:</span>
          </span>
          <span className="text-[#0F172A] font-medium">{telemetry.peak_memory_mb} MB</span>
        </div>
      )}
    </div>
  );
};
