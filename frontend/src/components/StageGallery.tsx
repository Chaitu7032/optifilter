import React from 'react';
import { Layers } from 'lucide-react';

interface StageItem {
  id: string;
  label: string;
  imageUri?: string;
  description?: string;
}

interface StageGalleryProps {
  stages: StageItem[];
  selectedStageId: string;
  onSelectStage: (stageId: string) => void;
  className?: string;
}

export const StageGallery: React.FC<StageGalleryProps> = ({
  stages,
  selectedStageId,
  onSelectStage,
  className = '',
}) => {
  const availableStages = stages.filter((s) => s.imageUri);

  if (availableStages.length === 0) return null;

  return (
    <div className={`bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs ${className}`}>
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0F172A]">
          <Layers className="w-3.5 h-3.5 text-[#059669]" />
          <span>Intermediate Pipeline Stages</span>
        </div>
        <span className="text-[11px] font-mono text-[#64748B]">
          {availableStages.length} sequential processing stages
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {availableStages.map((stage, idx) => {
          const isSelected = stage.id === selectedStageId;
          return (
            <button
              key={stage.id}
              onClick={() => onSelectStage(stage.id)}
              className={`flex flex-col items-center p-2 rounded-lg border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#059669] bg-[#059669]/5 shadow-xs ring-1 ring-[#059669]'
                  : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#CBD5E1]'
              }`}
            >
              <div className="relative w-full aspect-square bg-slate-900 rounded-md overflow-hidden mb-1.5 flex items-center justify-center border border-[#E2E8F0]">
                <img
                  src={stage.imageUri}
                  alt={stage.label}
                  className="w-full h-full object-contain pointer-events-none"
                  loading="lazy"
                />
                <span className="absolute top-1 left-1 bg-black/75 font-mono text-[9px] text-white px-1 rounded">
                  {idx + 1}
                </span>
              </div>
              <span
                className={`text-[11px] truncate w-full text-center ${
                  isSelected ? 'text-[#059669] font-bold' : 'text-[#64748B]'
                }`}
                title={stage.label}
              >
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
