import React from 'react';

interface BufferFillBarProps {
  count: number;
}

export function BufferFillBar({ count }: BufferFillBarProps) {
  const percentage = Math.min(100, (count / 500) * 100);

  // Set color according to rules: <100 red, 100-300 amber, 300+ green
  let barColorClass = 'bg-accent-green';
  let textColorClass = 'text-accent-green';
  if (count < 100) {
    barColorClass = 'bg-accent-red';
    textColorClass = 'text-accent-red';
  } else if (count < 300) {
    barColorClass = 'bg-accent-yellow'; // Or yellow/amber
    textColorClass = 'text-accent-yellow';
  }

  return (
    <div className="flex flex-col gap-2 w-full select-none">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-0.5 text-left">
          <span className="text-[8px] text-text-muted font-mono uppercase tracking-widest">
            Replay Memory Occupancy
          </span>
          <span className="text-[10px] font-mono font-semibold text-text-secondary">
            Learning works best above 100 demos
          </span>
        </div>
        <div className="font-mono text-xs font-black">
          <span className={textColorClass}>{count}</span>
          <span className="text-text-muted"> / 500</span>
        </div>
      </div>

      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div
          className={`h-full transition-all duration-500 ease-out ${barColorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
