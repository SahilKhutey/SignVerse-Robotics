import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import AppShell from './components/AppShell';

const TwinPage = React.lazy(() => import('./pages/TwinPage'));
const TelemetryPage = React.lazy(() => import('./pages/TelemetryPage'));
const CommandPage = React.lazy(() => import('./pages/CommandPage'));
const CollectorPage = React.lazy(() => import('./pages/CollectorPage'));
const TrainingPage = React.lazy(() => import('./pages/TrainingPage'));
const OnlineLearningPage = React.lazy(() => import('./pages/OnlineLearningPage'));
const SystemPage = React.lazy(() => import('./pages/SystemPage'));
const PerformancePage = React.lazy(() => import('./pages/PerformancePage'));
const SimulationPage = React.lazy(() => import('./pages/SimulationPage'));
const RLHFPage = React.lazy(() => import('./pages/RLHFPage'));
const ObserverPage = React.lazy(() => import('./pages/ObserverPage'));

const LoadingFallback = () => (
  <div className="h-full w-full flex flex-col items-center justify-center bg-[#07080a] gap-3">
    <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
    <span className="font-display text-[9px] tracking-widest text-text-secondary uppercase font-semibold">
      Loading Diagnostics Deck...
    </span>
  </div>
);

export default function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="observe" element={<ObserverPage />} />
            <Route path="/" element={<AppShell />}>
              <Route index element={<Navigate to="/twin" replace />} />
              <Route path="twin" element={<TwinPage />} />
              <Route path="telemetry" element={<TelemetryPage />} />
              <Route path="command" element={<CommandPage />} />
              <Route path="collector" element={<CollectorPage />} />
              <Route path="training" element={<TrainingPage />} />
              <Route path="online-learning" element={<OnlineLearningPage />} />
              <Route path="training/online" element={<Navigate to="/online-learning" replace />} />
              <Route path="system" element={<SystemPage />} />
              <Route path="performance" element={<PerformancePage />} />
              <Route path="simulation" element={<SimulationPage />} />
              <Route path="rlhf" element={<RLHFPage />} />
              <Route path="*" element={<Navigate to="/twin" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
