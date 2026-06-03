import React, { useRef, useEffect } from 'react';
import { useLearningStore } from '../../store/learning';
import { Layers } from 'lucide-react';

export default function ReplayBufferVisualizer() {
  const { demos } = useLearningStore();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the end when new demonstrations are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [demos.length]);

  return (
    <div className="glass-panel p-5 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-accent-violet" />
          <h2 className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase">
            REPLAY BUFFER (500 MAX CAPACITY)
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-text-muted">
          <span className="bg-white/5 px-2 py-0.5 rounded">
            Total Demos: {demos.length}
          </span>
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded animate-pulse">
            Active Batch: 20% Mixed
          </span>
        </div>
      </div>

      {demos.length === 0 ? (
        <div className="flex items-center justify-center min-h-[80px] bg-black/10 rounded-xl border border-dashed border-white/5">
          <span className="text-text-muted font-display text-[9px] font-bold tracking-widest uppercase">
            REPLAY BUFFER IS EMPTY
          </span>
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
        >
          {demos.map((demo, idx) => (
            <div
              key={demo.id || idx}
              className={`flex-shrink-0 w-[140px] p-3 rounded-xl border transition-all flex flex-col gap-2 relative overflow-hidden ${
                demo.highlighted
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                  : 'bg-white/5 border-white/5 hover:border-white/20'
              }`}
            >
              {/* Highlight Glow Indicator */}
              {demo.highlighted && (
                <div className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-amber-400 m-2 animate-ping" />
              )}

              {/* Label Info */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] font-display text-text-muted uppercase tracking-wider">
                  DEMO #{idx + 1}
                </span>
                <span className="text-[10px] font-mono font-semibold text-text-primary truncate" title={demo.label}>
                  {demo.label}
                </span>
              </div>

              {/* Divergence Metric */}
              <div className="flex justify-between items-center mt-1 border-t border-white/5 pt-1.5 text-[9px] font-mono">
                <span className="text-text-muted">Divergence</span>
                <span className={`font-bold ${demo.highlighted ? 'text-amber-400' : 'text-accent-cyan'}`}>
                  {demo.divergenceScore.toFixed(4)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
