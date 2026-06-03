import React, { useEffect } from 'react';
import { useRlhfStore } from '../../store/rlhf';
import { Flame, Clock, Award, HelpCircle } from 'lucide-react';

export default function AnnotationProgressCard() {
  const { ratedCount, targetReadyCount, progressPercent, estimatedHoursRemaining, streakDays, readyForTraining, fetchStatus } = useRlhfStore();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <div className="glass-panel p-5 flex flex-col gap-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Award size={18} className={readyForTraining ? 'text-amber-400 animate-bounce' : 'text-accent-cyan'} />
          <h2 className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase">
            HUMAN PREFERENCE PROGRESS
          </h2>
        </div>
        <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold border ${
          readyForTraining 
            ? 'bg-amber-400/10 border-amber-400/30 text-amber-400 animate-pulse' 
            : 'bg-white/5 border-white/5 text-text-secondary'
        }`}>
          {readyForTraining ? 'READY FOR RLHF' : 'ANNOTATING'}
        </span>
      </div>

      {/* Progress metrics */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-text-muted">PAIRS LABELED</span>
          <span className="font-bold text-text-primary">
            {ratedCount} <span className="text-text-muted">/ {targetReadyCount}</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-black/40 border border-white/5 overflow-hidden p-0.5">
          <div 
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              readyForTraining 
                ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.4)]' 
                : 'bg-gradient-to-r from-accent-cyan to-accent-violet'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        <div className="flex justify-between text-[8px] text-text-muted font-mono">
          <span>0%</span>
          <span>Target: 200 pairs</span>
          <span>100%</span>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-3 mt-1">
        {/* Streak Days */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between relative overflow-hidden">
          <div className="flex flex-col gap-0.5">
            <span className="text-[7px] font-display text-text-muted uppercase tracking-widest">
              DAILY STREAK
            </span>
            <span className="text-lg font-bold font-mono text-accent-red flex items-baseline gap-1 mt-0.5">
              {streakDays}
              <span className="text-[8px] text-text-muted uppercase font-sans font-normal">days</span>
            </span>
          </div>
          <Flame size={20} className={streakDays > 0 ? 'text-accent-red animate-pulse' : 'text-text-muted'} />
        </div>

        {/* Est hours remaining */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between relative overflow-hidden">
          <div className="flex flex-col gap-0.5">
            <span className="text-[7px] font-display text-text-muted uppercase tracking-widest">
              EST. TIME LEFT
            </span>
            <span className="text-lg font-bold font-mono text-accent-cyan flex items-baseline gap-1 mt-0.5">
              {estimatedHoursRemaining}
              <span className="text-[8px] text-text-muted uppercase font-sans font-normal">hrs</span>
            </span>
          </div>
          <Clock size={20} className="text-accent-cyan" />
        </div>
      </div>

      {/* Information Tip */}
      <div className="flex items-start gap-2 bg-white/5 border border-white/5 p-3 rounded-lg text-[9px] font-sans text-text-secondary leading-relaxed mt-1">
        <HelpCircle size={12} className="flex-shrink-0 mt-0.5 text-text-muted" />
        <p>
          Each rated pair helps train a 3-layer MLP **Reward Model**. A minimum of **200 pairs** is required to guarantee convergence and prevent policy deviations when fine-tuning.
        </p>
      </div>
    </div>
  );
}
