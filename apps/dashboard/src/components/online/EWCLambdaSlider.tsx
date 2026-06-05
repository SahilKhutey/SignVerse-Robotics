import React, { useState, useEffect, useRef } from 'react';
import { useOnlineConfig } from '../../hooks/useOnlineConfig';
import { useOnlineLearningStore } from '../../store/onlineLearning';

export function EWCLambdaSlider() {
  const learnerState = useOnlineLearningStore((state) => state.learnerState);
  const { updateConfig, isPending } = useOnlineConfig();

  const currentLambda = learnerState?.ewc_lambda ?? 400;
  const [localValue, setLocalValue] = useState(currentLambda);

  useEffect(() => {
    setLocalValue(currentLambda);
  }, [currentLambda]);

  const timerRef = useRef<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalValue(val);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateConfig({ ewc_lambda: val });
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Determine forgetting protection band label: 0-200 Low, 200-800 Medium, 800+ High
  let protectionLabel = 'Medium';
  let labelColorClass = 'text-accent-yellow';
  if (localValue <= 200) {
    protectionLabel = 'Low';
    labelColorClass = 'text-accent-red';
  } else if (localValue >= 800) {
    protectionLabel = 'High';
    labelColorClass = 'text-accent-green';
  }

  return (
    <div className="flex flex-col gap-2 select-none w-full">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-0.5 text-left">
          <span className="text-[8px] text-text-muted font-mono uppercase tracking-widest">
            EWC Penalty Lambda
          </span>
          <span className="text-[9px] text-text-secondary font-sans leading-tight">
            Higher = stronger protection against forgetting, slower adaptation
          </span>
        </div>
        <div className="flex flex-col items-end leading-none">
          <span className="font-mono text-xs font-black text-text-primary">
            {localValue}
          </span>
          <span className="text-[7px] font-mono mt-0.5 uppercase tracking-wide">
            Forgetting protection:{' '}
            <span className={`font-bold ${labelColorClass}`}>{protectionLabel}</span>
          </span>
        </div>
      </div>

      <div className="relative w-full flex items-center h-4">
        <input
          type="range"
          min={0}
          max={2000}
          step={50}
          value={localValue}
          onChange={handleChange}
          disabled={isPending}
          className="w-full h-1 bg-white/10 accent-accent-cyan rounded-lg appearance-none cursor-pointer disabled:opacity-50 transition-all"
        />
      </div>
    </div>
  );
}
