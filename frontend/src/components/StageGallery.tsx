import React from 'react';

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
    <div className={`bg-white border border-[#DFE4DF] rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#202824]">
          Intermediate Pipeline Stages
        </span>
        <span className="text-[11px] font-mono text-[#69736D]">
          {availableStages.length} inspectable steps
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {availableStages.map((stage) => {
          const isSelected = stage.id === selectedStageId;
          return (
            <button
              key={stage.id}
              onClick={() => onSelectStage(stage.id)}
              className={`flex flex-col items-center p-1.5 rounded-md border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#286B56] bg-[#DCEBE3]/40 shadow-xs ring-1 ring-[#286B56]'
                  : 'border-[#DFE4DF] bg-[#F5F6F4] hover:bg-white hover:border-[#CBD4CC]'
              }`}
            >
              <div className="w-full aspect-square bg-[#121614] rounded overflow-hidden mb-1 flex items-center justify-center">
                <img
                  src={stage.imageUri}
                  alt={stage.label}
                  className="w-full h-full object-contain pointer-events-none"
                />
              </div>
              <span className={`text-[10px] font-medium truncate w-full text-center ${
                isSelected ? 'text-[#286B56] font-semibold' : 'text-[#69736D]'
              }`}>
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
