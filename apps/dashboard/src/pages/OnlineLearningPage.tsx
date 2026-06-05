import React from 'react';
import { LearnerStatusCard } from '../components/online/LearnerStatusCard';
import { ForgettingMonitor } from '../components/online/ForgettingMonitor';
import { ReplayBufferPanel } from '../components/online/ReplayBufferPanel';
import { LearningRateSlider } from '../components/online/LearningRateSlider';
import { EWCLambdaSlider } from '../components/online/EWCLambdaSlider';
import { ReplayRatioSlider } from '../components/online/ReplayRatioSlider';
import { useOnlineLearningStore } from '../store/onlineLearning';
import { Brain, Sliders, AlertCircle } from 'lucide-react';

export default function OnlineLearningPage() {
  const learnerState = useOnlineLearningStore((state) => state.learnerState);
  const status = learnerState?.status ?? 'idle';
  const isPaused = status === 'paused';

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6 bg-[#07080a] scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
      {/* Page Header */}
      <div className="flex flex-col gap-1 select-none">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-accent-cyan" />
          <h2 className="font-display text-sm font-bold tracking-wider text-text-primary uppercase">
            Online Continuous Learning Studio
          </h2>
        </div>
        <p className="text-[10px] text-text-secondary">
          Monitor and adjust real-time behavioral cloning parameters. Control catastrophic forgetting EWC penalties, adjust learning rates dynamically, and inspect experience replay memory.
        </p>
      </div>

      {/* Non-intrusive Pause Amber Banner */}
      {isPaused && (
        <div className="bg-accent-yellow/10 border border-accent-yellow/20 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="text-accent-yellow flex-shrink-0" size={16} />
          <div className="flex flex-col gap-0.5 text-left leading-tight">
            <span className="text-[10px] font-bold text-accent-yellow font-display uppercase tracking-wider">
              Fine-Tuning Suspended
            </span>
            <span className="text-[9px] text-text-secondary">
              Learning paused — demos are being saved but not used for updates.
            </span>
          </div>
        </div>
      )}

      {/* Top Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Top Left: Status Card */}
        <div className="lg:col-span-1 flex">
          <LearnerStatusCard />
        </div>

        {/* Top Right: Sliders Panel */}
        <div className="lg:col-span-2 glass-panel p-5 flex flex-col gap-5">
          <div className="flex items-center gap-1.5 text-text-primary border-b border-white/5 pb-2">
            <Sliders size={13} className="text-accent-cyan" />
            <span className="font-display text-xs font-semibold tracking-wider uppercase select-none">
              HYPERPARAMETER CONFIGURATION
            </span>
          </div>
          <div className="flex flex-col gap-6 justify-center flex-1">
            <LearningRateSlider />
            <EWCLambdaSlider />
            <ReplayRatioSlider />
          </div>
        </div>
      </div>

      {/* Middle: Forgetting Monitor */}
      <div className="w-full">
        <ForgettingMonitor />
      </div>

      {/* Bottom: Replay Buffer Catalog */}
      <div className="w-full">
        <ReplayBufferPanel />
      </div>
    </div>
  );
}
