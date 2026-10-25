import React from 'react';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
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
    <div className={`bg-white border border-[#DFE4DF] rounded-lg p-3 text-xs ${className}`}>
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#DFE4DF]">
        <div className="flex items-center gap-1.5 font-semibold text-[#202824]">
          <Clock className="w-3.5 h-3.5 text-[#286B56]" />
          <span>CPU Profiling Breakdown</span>
        </div>
        <div className="flex items-center gap-1 font-mono">
          <span className="text-sm font-semibold text-[#286B56]">
            {telemetry.total_ms.toFixed(1)} ms
          </span>
          {isUnder2s ? (
            <span className="flex items-center text-[10px] text-[#286B56] bg-[#DCEBE3] px-1.5 py-0.5 rounded font-medium">
              <CheckCircle2 className="w-3 h-3 mr-0.5" /> &lt;2s CPU Target
            </span>
          ) : (
            <span className="flex items-center text-[10px] text-[#B7791F] bg-[#FEF3C7] px-1.5 py-0.5 rounded font-medium">
              <AlertCircle className="w-3 h-3 mr-0.5" /> &gt;2s
            </span>
          )}
        </div>
      </div>

      {/* Sub-stages breakdown */}
      {telemetry.stages_ms && Object.keys(telemetry.stages_ms).length > 0 && (
        <div className="space-y-1 font-mono text-[11px]">
          {Object.entries(telemetry.stages_ms).map(([stage, ms]) => {
            const pct = Math.min(100, Math.round((Number(ms) / telemetry.total_ms) * 100));
            return (
              <div key={stage} className="flex items-center justify-between text-[#69736D]">
                <span className="capitalize">{stage.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-[#F5F6F4] rounded-full overflow-hidden border border-[#DFE4DF]">
                    <div
                      className="h-full bg-[#286B56]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[#202824] w-14 text-right">
                    {Number(ms).toFixed(1)} ms
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Memory delta */}
      {telemetry.memory_delta_mb !== undefined && (
        <div className="mt-2 pt-2 border-t border-[#DFE4DF] flex justify-between text-[11px] font-mono text-[#69736D]">
          <span>Peak RSS Memory:</span>
          <span className="text-[#202824] font-medium">{telemetry.peak_memory_mb} MB</span>
        </div>
      )}
    </div>
  );
};
