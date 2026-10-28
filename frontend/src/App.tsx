import React, { useState, useEffect } from 'react';
import { WorkstationProvider, useWorkstationMode } from './context/WorkstationContext';
import { AppHeader } from './components/AppHeader';
import { WorkspacePage } from './pages/WorkspacePage';
import { VesselAnalysisPage } from './pages/VesselAnalysisPage';
import { DiscCupPage } from './pages/DiscCupPage';
import { BenchmarkLabPage } from './pages/BenchmarkLabPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { fetchHealth } from './services/api';

function MainWorkstation() {
  const [currentTab, setCurrentTab] = useState<string>('workspace');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['workspace']));
  const [systemInfo, setSystemInfo] = useState<Record<string, string> | undefined>(undefined);
  const { isClinic } = useWorkstationMode();

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(currentTab)) return prev;
      const next = new Set(prev);
      next.add(currentTab);
      return next;
    });
  }, [currentTab]);

  useEffect(() => {
    fetchHealth()
      .then((data) => setSystemInfo(data.system))
      .catch((err) => console.warn('Backend offline or health check failed', err));
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col antialiased selection:bg-[#10B981]/20 selection:text-[#059669]">
      {/* Top Application Header */}
      <AppHeader
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        systemInfo={systemInfo}
      />

      {/* Main Scientific Workstation Canvas - Preserves page state across tab switches */}
      <main className="flex-1 pb-10">
        <div style={{ display: currentTab === 'workspace' ? 'block' : 'none' }}>
          <WorkspacePage />
        </div>
        {visitedTabs.has('vessels') && (
          <div style={{ display: currentTab === 'vessels' ? 'block' : 'none' }}>
            <VesselAnalysisPage />
          </div>
        )}
        {visitedTabs.has('disc-cup') && (
          <div style={{ display: currentTab === 'disc-cup' ? 'block' : 'none' }}>
            <DiscCupPage />
          </div>
        )}
        {visitedTabs.has('benchmarks') && (
          <div style={{ display: currentTab === 'benchmarks' ? 'block' : 'none' }}>
            <BenchmarkLabPage />
          </div>
        )}
        {visitedTabs.has('experiments') && (
          <div style={{ display: currentTab === 'experiments' ? 'block' : 'none' }}>
            <ExperimentsPage />
          </div>
        )}
        {visitedTabs.has('docs') && (
          <div style={{ display: currentTab === 'docs' ? 'block' : 'none' }}>
            <DocumentationPage />
          </div>
        )}
      </main>

      {/* Scientific Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-2.5 px-4 sm:px-6 text-xs text-[#64748B]">
        <div className="max-w-[1780px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[#0F172A]">OptiFilter / MorphoVision</span>
            <span className="text-[#CBD5E1]">•</span>
            <span>Academic Classical Digital Image Processing Workstation</span>
            <span className="text-[#CBD5E1]">•</span>
            <span className="text-[#059669] font-medium">Deterministic CV (0.00% AI/ML)</span>
            <span className="text-[#CBD5E1]">•</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              isClinic
                ? 'bg-[#0EA5E9]/10 text-[#0284C7] border-[#0EA5E9]/30 font-medium'
                : 'bg-[#10B981]/10 text-[#059669] border-[#10B981]/30 font-medium'
            }`}>
              {isClinic ? '🔬 Clinic Mode Active' : '🎓 Student Mode Active'}
            </span>
          </div>
          <div className="font-mono text-[11px] text-[#94A3B8]">
            Target: &lt; 2,000 ms CPU Latency • Strict FOV Boundary Evaluation
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <WorkstationProvider>
      <MainWorkstation />
    </WorkstationProvider>
  );
}

export default App;
