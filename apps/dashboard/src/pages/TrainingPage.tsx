import React, { useState } from 'react';
import { useNotificationsStore } from '../store/notifications';
import TrainButton from '../components/training/TrainButton';
import LossChart from '../components/training/LossChart';
import ModelVersionList from '../components/training/ModelVersionList';
import { Brain, Settings } from 'lucide-react';
import OnlineLearningControls from '../components/learning/OnlineLearningControls';
import ForgettingMonitor from '../components/learning/ForgettingMonitor';
import ReplayBufferVisualizer from '../components/learning/ReplayBufferVisualizer';

export default function TrainingPage() {
  const addLog = useNotificationsStore((state) => state.addLog);
  const [isTraining, setIsTraining] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTrainingStarted = () => {
    setIsTraining(true);
    addLog('🚀 Spawning optimization trainer daemon. Monitoring live loss metrics...', 'info');
  };

  const handleTrainingHalted = () => {
    setIsTraining(false);
  };

  const handleTrainingComplete = () => {
    setIsTraining(false);
    addLog('🏆 Online Behavior Cloning policy converged successfully! Checkpoints updated.', 'success');
    
    // Auto-refresh the models catalog to load the newly created policy pth file
    setRefreshTrigger((prev) => prev + 1);
    
    // Trigger desktop toast notification if window is active
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('SignVerse OS Kernel', {
        body: 'Policy training converged successfully! Weights hot-swap ready.',
        icon: '/favicon.ico'
      });
    } else {
      // Trigger a standard browser alert fallback
      alert('🟢 Online Behavior Cloning policy has finished training! Weights hot-swap is ready.');
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6 bg-[#07080a]">
      {/* Page Header */}
      <div className="flex flex-col gap-1 select-none">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-accent-cyan" />
          <h2 className="font-display text-sm font-bold tracking-wider text-text-primary uppercase">
            Policy Training Studio
          </h2>
        </div>
        <p className="text-[10px] text-text-secondary">
          Configure behavior cloning hyperparameters, select network architectures, and run imitation training on collected datasets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Col: Configurations & Trainers Trigger */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="glass-panel p-5 flex flex-col gap-4 select-none">
            <div className="flex items-center gap-1.5 text-text-primary">
              <Settings size={13} className="text-accent-cyan" />
              <span className="font-display text-xs font-semibold tracking-wider uppercase">
                POLICY HYPERPARAMETERS
              </span>
            </div>

            {/* Model Architecture Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[8px] text-text-muted uppercase font-mono">Network Architecture</label>
              <select
                disabled={isTraining}
                defaultValue="diffusion_policy"
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-sans text-text-primary focus:outline-none focus:border-accent-cyan w-full cursor-pointer disabled:text-text-muted transition-all"
              >
                <option value="resnet_bc">ResNet-18 Behavior Cloning</option>
                <option value="diffusion_policy">Diffusion Policy (L1 loss)</option>
                <option value="transformer_act">Action Chunking Transformer (ACT)</option>
              </select>
            </div>

            {/* Hyperparameters Config */}
            <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
              <div className="flex flex-col gap-1 text-left">
                <span className="text-[8px] text-text-muted uppercase">Learning Rate</span>
                <input
                  type="text"
                  defaultValue="1e-4"
                  disabled={isTraining}
                  className="bg-black/35 border border-white/5 rounded px-2.5 py-1 text-accent-cyan disabled:text-text-muted transition-all"
                />
              </div>
              <div className="flex flex-col gap-1 text-left">
                <span className="text-[8px] text-text-muted uppercase">Batch Size</span>
                <input
                  type="number"
                  defaultValue={64}
                  disabled={isTraining}
                  className="bg-black/35 border border-white/5 rounded px-2.5 py-1 text-accent-cyan disabled:text-text-muted transition-all"
                />
              </div>
            </div>
          </div>

          {/* Dataset summary & training control actions */}
          <TrainButton
            isTraining={isTraining}
            onTrainingStarted={handleTrainingStarted}
            onTrainingHalted={handleTrainingHalted}
            refreshTrigger={refreshTrigger}
          />

          {/* Checkpoint list manager */}
          <ModelVersionList
            refreshTrigger={refreshTrigger}
            onRefresh={handleRefresh}
          />
        </div>

        {/* Right Col: Loss curves visual progress */}
        <LossChart
          isTraining={isTraining}
          onTrainingComplete={handleTrainingComplete}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Online Learning / Fine-Tuning Section */}
      <div className="border-t border-white/5 pt-6 flex flex-col gap-6">
        <div className="flex flex-col gap-1 select-none">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
            <h3 className="font-display text-xs font-bold tracking-wider text-text-primary uppercase">
              Online Fine-Tuning Dashboard
            </h3>
          </div>
          <p className="text-[10px] text-text-secondary">
            Model weights adjust in real-time after every recorded demonstration. Track replay memory distribution and catastrophic forgetting.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Config */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <OnlineLearningControls />
          </div>

          {/* Right Column: Forgetting Monitor & Replay Buffer */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <ForgettingMonitor />
            <ReplayBufferVisualizer />
          </div>
        </div>
      </div>
    </div>
  );
}
