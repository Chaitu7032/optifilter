import React, { useState } from 'react';
import { Aperture, Cpu, ShieldCheck, Settings, Info, X } from 'lucide-react';

interface AppHeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  systemInfo?: Record<string, string>;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  onTabChange,
  systemInfo,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const navItems = [
    { id: 'workspace', label: 'Image Workspace' },
    { id: 'vessels', label: 'Vessel Analysis' },
    { id: 'disc-cup', label: 'Disc & Cup Analysis' },
    { id: 'benchmarks', label: 'Benchmark Laboratory' },
    { id: 'experiments', label: 'Experiments' },
    { id: 'docs', label: 'Documentation' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#DFE4DF]">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#286B56] text-white flex items-center justify-center shadow-xs">
              <Aperture className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-[#202824]">
                  OptiFilter
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono font-medium bg-[#DCEBE3] text-[#286B56]">
                  MorphoVision v1.0
                </span>
              </div>
            </div>
          </div>

          {/* Central Slim Navigation Rail */}
          <nav className="flex items-center gap-1 bg-[#F5F6F4] p-1 rounded-lg border border-[#DFE4DF]">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  currentTab === item.id
                    ? 'bg-white text-[#286B56] shadow-2xs font-semibold'
                    : 'text-[#69736D] hover:text-[#202824]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Status Badges & Controls */}
          <div className="flex items-center gap-2.5">
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#DFE4DF] bg-[#F5F6F4] text-xs font-mono text-[#69736D]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#286B56]" />
              <span>Classical DIP Only</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#DFE4DF] bg-white text-xs font-mono text-[#202824]">
              <Cpu className="w-3.5 h-3.5 text-[#286B56]" />
              <span>CPU Execution</span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-[#69736D] hover:text-[#202824] hover:bg-[#F5F6F4] rounded-md transition-colors cursor-pointer"
              title="System Metadata & Parameters"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings & System Info Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#DFE4DF] shadow-lg max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-[#DFE4DF] mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#286B56]" />
                <h3 className="font-semibold text-sm text-[#202824]">Scientific System Architecture</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[#69736D] hover:text-[#202824] p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="text-[#69736D] mb-1">DIP Engine Principles</p>
                <div className="p-3 bg-[#F5F6F4] rounded border border-[#DFE4DF] space-y-1.5">
                  <p className="flex justify-between">
                    <span className="text-[#69736D]">Algorithm Framework:</span>
                    <span className="font-mono font-medium text-[#202824]">OpenCV, SciPy, scikit-image</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-[#69736D]">Machine Learning:</span>
                    <span className="font-mono font-semibold text-[#286B56]">Strictly Zero (0.00%)</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-[#69736D]">Target Latency:</span>
                    <span className="font-mono text-[#202824]">&lt; 2,000 ms per image (CPU)</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-[#69736D]">FOV Evaluation:</span>
                    <span className="font-mono text-[#202824]">Strict FOV boundary exclusion</span>
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[#69736D] mb-1">Host Hardware Telemetry</p>
                <div className="p-3 bg-[#F5F6F4] rounded border border-[#DFE4DF] font-mono space-y-1">
                  <p className="text-[#69736D]">OS: <span className="text-[#202824]">{systemInfo?.os || 'Windows Native'}</span></p>
                  <p className="text-[#69736D]">Python: <span className="text-[#202824]">{systemInfo?.python_version || '3.12'}</span></p>
                  <p className="text-[#69736D]">Processor: <span className="text-[#202824]">{systemInfo?.processor || 'x86_64 CPU'}</span></p>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-[#69736D] leading-relaxed border-t border-[#DFE4DF]">
                OptiFilter is an academic scientific image workstation designed for reproducible retinal fundus research. All displayed measurements represent deterministic spatial evaluations without clinical diagnostic claims.
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 bg-[#286B56] hover:bg-[#205746] text-white rounded text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
