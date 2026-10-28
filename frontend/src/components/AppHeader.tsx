import React, { useState } from 'react';
import {
  Aperture,
  Cpu,
  ShieldCheck,
  Settings,
  Info,
  X,
  LayoutGrid,
  Activity,
  Eye,
  BarChart2,
  FlaskConical,
  BookOpen,
  GraduationCap,
  Microscope,
} from 'lucide-react';
import { useWorkstationMode } from '../context/WorkstationContext';

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
  const { setMode, isClinic } = useWorkstationMode();

  const navItems = [
    { id: 'workspace', label: 'Image Workspace', icon: LayoutGrid },
    { id: 'vessels', label: 'Vessel Analysis', icon: Activity },
    { id: 'disc-cup', label: 'Disc & Cup Analysis', icon: Eye },
    { id: 'benchmarks', label: 'Benchmark Laboratory', icon: BarChart2 },
    { id: 'experiments', label: 'Experiments', icon: FlaskConical },
    { id: 'docs', label: 'Documentation', icon: BookOpen },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] shadow-xs select-none">
        <div className="max-w-[1780px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#047857] text-white flex items-center justify-center shadow-xs ring-1 ring-emerald-500/20">
              <Aperture className="w-4.5 h-4.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#0F172A] font-sans">
                OptiFilter
              </span>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full font-mono font-medium bg-[#14B8A6]/10 text-[#0D9488] border border-[#14B8A6]/20">
                MorphoVision
              </span>
            </div>
          </div>

          {/* Central Slim Navigation Rail */}
          <nav className="hidden md:flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#059669] border border-[#E2E8F0] shadow-xs font-semibold'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white/60 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#059669]' : 'text-[#94A3B8]'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Mode Switch & Status Badges */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mode Switch: Student Mode vs Clinic Mode */}
            <div
              className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]"
              title="Toggle between Student Mode (streamlined presentation) and Clinic Mode (full research controls & metrics)"
            >
              <button
                onClick={() => setMode('student')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  !isClinic
                    ? 'bg-white text-[#059669] border border-[#10B981]/30 font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] border border-transparent'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Student</span>
              </button>

              <button
                onClick={() => setMode('clinic')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  isClinic
                    ? 'bg-white text-[#0284C7] border border-[#0EA5E9]/30 font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] border border-transparent'
                }`}
              >
                <Microscope className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clinic</span>
              </button>
            </div>

            {/* Scientific Telemetry Badges */}
            <div className="hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-mono text-[#64748B]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
              <span>Classical DIP</span>
            </div>

            <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-mono text-[#64748B]">
              <Cpu className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>CPU &lt;2s</span>
            </div>

            {/* Restrained Settings Modal Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer border border-[#E2E8F0]"
              title="System Metadata, Architecture & Telemetry"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile/Compact Tablet Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto px-2 py-1.5 border-t border-[#E2E8F0] bg-[#F8FAFC] gap-1 text-xs">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`px-2.5 py-1 rounded whitespace-nowrap text-xs transition-colors cursor-pointer ${
                currentTab === item.id
                  ? 'bg-white text-[#059669] font-semibold border border-[#E2E8F0] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Settings & System Architecture Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#059669]" />
                <h3 className="font-semibold text-sm text-[#0F172A]">System Architecture &amp; DIP Engine</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="text-[#64748B] mb-1 font-medium">Deterministic DIP Engine</p>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748B]">Core Libraries:</span>
                    <span className="font-mono text-[#0F172A] text-[11px] font-medium">OpenCV, SciPy, scikit-image</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748B]">Neural Networks / AI:</span>
                    <span className="font-mono font-semibold text-[#059669] text-[11px]">Strictly Zero (0.00%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748B]">Target CPU Latency:</span>
                    <span className="font-mono text-[#0F172A] text-[11px]">&lt; 2,000 ms / scan</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748B]">FOV Boundary Masking:</span>
                    <span className="font-mono text-[#0284C7] text-[11px]">Enforced in all evaluations</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[#64748B] mb-1 font-medium">Hardware Telemetry</p>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] font-mono text-[11px] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Host Platform:</span>
                    <span className="text-[#0F172A]">{systemInfo?.os || 'Windows Native'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Python Runtime:</span>
                    <span className="text-[#0F172A]">{systemInfo?.python_version || '3.12'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Processor Arch:</span>
                    <span className="text-[#0F172A]">{systemInfo?.processor || 'x86_64 CPU'}</span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] text-[11px] text-[#475569] leading-relaxed">
                <span className="font-semibold text-[#0F172A]">Active Mode: </span>
                {isClinic
                  ? 'Clinic Mode reveals full hyperparameter controls, raw confusion matrices, and ablation comparisons for advanced scientific research.'
                  : 'Student Mode streamlines the interface for university presentation, focusing on clear retinal visualization and conceptual workflow.'}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
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
