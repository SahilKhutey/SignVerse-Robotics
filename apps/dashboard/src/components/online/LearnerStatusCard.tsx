import React from 'react';
import { useLearnerState } from '../../hooks/useLearnerState';
import { useOnlinePause } from '../../hooks/useOnlinePause';
import { useOnlineLearningStore } from '../../store/onlineLearning';
import { RefreshCw, Play, Pause } from 'lucide-react';

export function LearnerStatusCard() {
  // Poll learner state (updates store automatically)
  const { isLoading: isPolling } = useLearnerState();
  const { setPause, isPending } = useOnlinePause();

  // Read state from Zustand store
  const learnerState = useOnlineLearningStore((state) => state.learnerState);
  const wsState = useOnlineLearningStore((state) => state.wsState);

  const status = learnerState?.status ?? 'idle';
  const totalSteps = learnerState?.total_steps ?? 0;
  const currentLr = learnerState?.current_lr ?? 1e-4;
  const bufferSize = learnerState?.replay_buffer_size ?? 0;
  const lastCheckpoint = learnerState?.last_checkpoint_step;

  const isPaused = status === 'paused';

  const handleTogglePause = () => {
    setPause(!isPaused);
  };

  // Badge styles: IDLE=gray, UPDATING=amber pulse, PAUSED=blue, ERROR=red
  let badgeColorClass = 'bg-white/10 text-text-secondary border-white/5';
  let badgeLabel = 'IDLE';
  let pulseClass = '';

  if (status === 'updating') {
    badgeColorClass = 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/20';
    badgeLabel = 'UPDATING';
    pulseClass = 'animate-pulse';
  } else if (status === 'paused') {
    badgeColorClass = 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/20';
    badgeLabel = 'PAUSED';
  } else if (status === 'error' || wsState === 'error') {
    badgeColorClass = 'bg-accent-red/15 text-accent-red border-accent-red/20';
    badgeLabel = 'ERROR';
  }

  const formatSci = (val: number) => {
    return val.toExponential(1);
  };

  const bufferPercentage = Math.min(100, (bufferSize / 500) * 100);

  return (
    <div className="glass-panel p-5 flex flex-col gap-5 w-full select-none">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex flex-col gap-0.5 text-left">
          <span className="text-[10px] font-display font-bold tracking-widest text-text-primary uppercase">
            LEARNING STATE PIPELINE
          </span>
          <span className="text-[8px] text-text-muted font-mono uppercase">
            Gateway: {wsState === 'live' ? 'CONNECTED' : wsState.toUpperCase()}
          </span>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-mono font-bold leading-none ${badgeColorClass} ${pulseClass}`}>
          {status === 'updating' && <span className="h-1.5 w-1.5 rounded-full bg-accent-yellow animate-ping" />}
          {badgeLabel}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-[10px] font-mono leading-none">
        <div className="flex flex-col gap-1.5 text-left">
          <span className="text-[8px] text-text-muted uppercase">Total Optimization Steps</span>
          <span className="text-text-primary font-bold text-sm leading-none">
            {totalSteps}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <span className="text-[8px] text-text-muted uppercase">Learning Rate</span>
          <span className="text-accent-cyan font-bold text-sm leading-none">
            {formatSci(currentLr)}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-left col-span-2">
          <div className="flex justify-between items-center text-[8px] text-text-muted uppercase">
            <span>Replay Buffer Fill</span>
            <span>{bufferSize} / 500</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 mt-0.5">
            <div
              className="h-full bg-accent-cyan transition-all duration-300"
              style={{ width: `${bufferPercentage}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-left col-span-2 border-t border-white/5 pt-3">
          <span className="text-[8px] text-text-muted uppercase">Last Saved Checkpoint Step</span>
          <span className="text-text-secondary font-bold">
            {lastCheckpoint !== null && lastCheckpoint !== undefined ? `Step ${lastCheckpoint}` : 'None'}
          </span>
        </div>
      </div>

      <button
        onClick={handleTogglePause}
        disabled={isPending || status === 'error'}
        className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 border font-display text-[10px] font-bold tracking-wider transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isPaused
            ? 'bg-accent-cyan/15 hover:bg-accent-cyan/25 border-accent-cyan/30 text-accent-cyan hover:shadow-[0_0_15px_rgba(0,240,255,0.15)]'
            : 'bg-accent-red/15 hover:bg-accent-red/25 border-accent-red/30 text-accent-red hover:shadow-[0_0_15px_rgba(255,51,102,0.15)]'
        }`}
      >
        {isPending ? (
          <RefreshCw size={11} className="animate-spin" />
        ) : isPaused ? (
          <Play size={10} fill="currentColor" />
        ) : (
          <Pause size={10} fill="currentColor" />
        )}
        {isPaused ? 'RESUME LEARNING' : 'PAUSE LEARNING'}
      </button>
    </div>
  );
}
