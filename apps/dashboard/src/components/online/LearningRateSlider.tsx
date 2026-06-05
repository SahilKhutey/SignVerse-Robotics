import React, { useState, useEffect, useRef } from 'react';
import { useOnlineConfig } from '../../hooks/useOnlineConfig';
import { useOnlineLearningStore } from '../../store/onlineLearning';

export function LearningRateSlider() {
  const learnerState = useOnlineLearningStore((state) => state.learnerState);
  const lrHistory = useOnlineLearningStore((state) => state.lrHistory);
  const { updateConfig, isPending } = useOnlineConfig();

  const currentLr = learnerState?.current_lr ?? 1e-4;
  const [localValue, setLocalValue] = useState(currentLr);

  useEffect(() => {
    setLocalValue(currentLr);
  }, [currentLr]);

  const timerRef = useRef<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalValue(val);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateConfig({ learning_rate: val });
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const formatSci = (val: number) => {
    return val.toExponential(1);
  };

  const latestLrHistory = lrHistory[lrHistory.length - 1];
  const stepsAgo = latestLrHistory && learnerState
    ? Math.max(0, learnerState.total_steps - latestLrHistory.step)
    : null;

  const isDanger = localValue > 0.0002;

  return (
    <div className="flex flex-col gap-2 select-none w-full">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-0.5 text-left">
          <span className="text-[8px] text-text-muted font-mono uppercase tracking-widest">
            Learning Rate (LR)
          </span>
          <span className="text-[9px] text-text-secondary">
            Controls gradient update step size
          </span>
        </div>
        <div className="flex flex-col items-end leading-none">
          <span className={`font-mono text-xs font-black ${isDanger ? 'text-accent-red' : 'text-accent-cyan'}`}>
            {formatSci(localValue)}
          </span>
          {stepsAgo !== null && (
            <span className="text-[7px] text-text-muted font-mono mt-0.5">
              last updated {stepsAgo} steps ago
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full flex items-center h-4">
        <input
          type="range"
          min={0.00001}
          max={0.0005}
          step={0.00001}
          value={localValue}
          onChange={handleChange}
          disabled={isPending}
          className={`w-full h-1 rounded-lg appearance-none cursor-pointer disabled:opacity-50 transition-all ${
            isDanger
              ? 'bg-accent-red/25 accent-accent-red danger-zone'
              : 'bg-white/10 accent-accent-cyan'
          }`}
        />
      </div>
    </div>
  );
}
