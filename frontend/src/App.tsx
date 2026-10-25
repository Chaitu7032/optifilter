import React, { useState, useEffect } from 'react';
import { AppHeader } from './components/AppHeader';
import { WorkspacePage } from './pages/WorkspacePage';
import { VesselAnalysisPage } from './pages/VesselAnalysisPage';
import { DiscCupPage } from './pages/DiscCupPage';
import { BenchmarkLabPage } from './pages/BenchmarkLabPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { fetchHealth } from './services/api';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('workspace');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['workspace']));
  const [systemInfo, setSystemInfo] = useState<Record<string, string> | undefined>(undefined);

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
    <div className="min-h-screen bg-[#F5F6F4] text-[#202824] flex flex-col">
      {/* Top Application Header */}
      <AppHeader
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        systemInfo={systemInfo}
      />

      {/* Main Scientific Workstation Canvas - Preserves page state across tab switches */}
      <main className="flex-1 pb-12">
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
      <footer className="border-t border-[#DFE4DF] bg-white py-3 px-6 text-xs text-[#69736D]">
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#202824]">OptiFilter / MorphoVision</span>
            <span>•</span>
            <span>Academic Classical Digital Image Processing Workstation</span>
            <span>•</span>
            <span className="text-[#286B56] font-medium">Zero AI / ML Guarantee</span>
          </div>
          <div className="font-mono text-[11px]">
            Target: &lt; 2000 ms CPU Latency • Deterministic Computer Vision
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
