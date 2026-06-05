import React, { useState, useEffect, useRef } from 'react';
import { useOnlineConfig } from '../../hooks/useOnlineConfig';
import { useOnlineLearningStore } from '../../store/onlineLearning';

export function ReplayRatioSlider() {
  const learnerState = useOnlineLearningStore((state) => state.learnerState);
  const { updateConfig, isPending } = useOnlineConfig();

  // Python backend uses 0.2 default if not configured, wait let's use 0.2 as baseline
  const currentRatio = learnerState?.total_steps ? 0.2 : 0.2; // default 0.2
  // Wait, let's see if gateway returns replay_ratio, no it doesn't return it in OnlineLearnerState, but wait, the POST config takes it. Let's keep local state or default of 20%.
  const [localValue, setLocalValue] = useState(currentRatio);

  const timerRef = useRef<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalValue(val);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateConfig({ replay_ratio: val });
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 select-none w-full">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-0.5 text-left">
          <span className="text-[8px] text-text-muted font-mono uppercase tracking-widest">
            Replay Buffer Ratio
          </span>
          <span className="text-[9px] text-text-secondary font-sans leading-tight">
            % of each training batch drawn from past demonstrations
          </span>
        </div>
        <div className="flex flex-col items-end leading-none">
          <span className="font-mono text-xs font-black text-accent-cyan">
            {Math.round(localValue * 100)}%
          </span>
        </div>
      </div>

      <div className="relative w-full flex items-center h-4">
        <input
          type="range"
          min={0.1}
          max={0.5}
          step={0.05}
          value={localValue}
          onChange={handleChange}
          disabled={isPending}
          className="w-full h-1 bg-white/10 accent-accent-cyan rounded-lg appearance-none cursor-pointer disabled:opacity-50 transition-all"
        />
      </div>
    </div>
  );
}
