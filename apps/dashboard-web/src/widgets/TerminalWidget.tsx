import React from 'react';

export const TerminalWidget = () => {
  return (
    <div className="p-4 font-mono text-[11px] text-green-500 bg-black h-full overflow-y-auto">
      <div className="mb-1">{'>'} [System] Initializing OS...</div>
      <div className="mb-1">{'>'} [System] Connecting to Inference Gateway...</div>
      <div className="mb-1">{'>'} [Inference] MediaPipe pipeline loaded.</div>
      <div className="mb-1">{'>'} [Inference] YOLOv8 tracking started.</div>
    </div>
  );
};
