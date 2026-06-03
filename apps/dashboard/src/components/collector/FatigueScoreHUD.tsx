import React from 'react';
import { useFatigueStore } from '../../store/fatigue';
import { Eye, Heading, Activity, Flame } from 'lucide-react';

export default function FatigueScoreHUD() {
  const { fatigueScore, state, signals, calibrating } = useFatigueStore();

  // Color helpers based on state
  const getColorClass = () => {
    if (state === 'fatigued') return 'text-accent-red';
    if (state === 'caution') return 'text-amber-500';
    return 'text-accent-green';
  };

  const getStrokeColor = () => {
    if (state === 'fatigued') return '#ff3366'; // accent-red
    if (state === 'caution') return '#f59e0b'; // amber-500
    return '#10b981'; // accent-green (emerald)
  };

  // Ring gauge math
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (fatigueScore * circumference);

  // Sub-indicator calculations (scaled 0 to 1 for display)
  // 1. Eye: EAR normal is 0.3. Score is higher when EAR drops or is abnormal
  const eyeScore = Math.min(1.0, signals.ear < 0.2 ? 1.0 : (15 - Math.min(15, signals.head_pitch)) / 15); 
  // Let's use simple logic for display bars based on signals or derived scores
  // EAR normal range (0.25 to 0.35) -> 0% fatigue. EAR < 0.2 -> spikes eye score.
  const eyeFatigueBar = signals.ear < 0.2 ? 1.0 : Math.max(0.0, Math.min(1.0, (0.3 - signals.ear) / 0.15));
  
  // Head Pitch: pitch deviation > 20° is 100% droop
  const headFatigueBar = Math.min(1.0, signals.head_pitch / 20.0);
  
  // Hand Velocity: velocity drop (signals.hand_velocity compared to baseline or absolute values)
  const handFatigueBar = Math.max(0.0, Math.min(1.0, 1.0 - signals.hand_velocity * 10)); // simple representation for display

  return (
    <div className="absolute top-4 right-4 z-20 glass-panel p-4 flex flex-col gap-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl w-48 shadow-[0_0_20px_rgba(0,0,0,0.8)] select-none">
      {/* HUD Title */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-1.5 font-mono text-[8px] text-text-secondary font-bold tracking-widest uppercase">
          <Activity size={10} className="text-accent-cyan" />
          <span>BIOMETRIC MON</span>
        </div>
        {calibrating && (
          <span className="animate-pulse bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-[7px] font-mono px-1 rounded">
            CALIBRATING
          </span>
        )}
      </div>

      {/* Circle Gauge Section */}
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 flex-shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background ring */}
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="#ffffff08"
              strokeWidth="4"
              fill="transparent"
            />
            {/* Active ring */}
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke={getStrokeColor()}
              strokeWidth="4.5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300"
              style={{
                filter: `drop-shadow(0 0 4px ${getStrokeColor()}40)`
              }}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center font-mono">
            <span className={`text-[11px] font-bold ${getColorClass()}`}>
              {Math.round(fatigueScore * 100)}%
            </span>
            <span className="text-[6px] text-text-muted uppercase">FATIGUE</span>
          </div>
        </div>

        {/* Text descriptions */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[8px] text-text-muted font-mono uppercase tracking-wider">STATE</span>
          <span className={`font-display text-[10px] font-black uppercase tracking-widest ${getColorClass()}`}>
            {state}
          </span>
          <span className="text-[7px] text-text-secondary font-mono truncate">
            Score: {fatigueScore.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Sub-Indicators Bars */}
      <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
        {/* Eye aspect bar */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between font-mono text-[7px] text-text-secondary">
            <span className="flex items-center gap-0.5">
              <Eye size={8} /> Eye (EAR: {signals.ear.toFixed(2)})
            </span>
            <span>{Math.round(eyeFatigueBar * 100)}%</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-cyan transition-all duration-300"
              style={{ width: `${eyeFatigueBar * 100}%` }}
            />
          </div>
        </div>

        {/* Head Pitch bar */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between font-mono text-[7px] text-text-secondary">
            <span className="flex items-center gap-0.5">
              <Heading size={8} /> Head (Pitch: {signals.head_pitch.toFixed(1)}°)
            </span>
            <span>{Math.round(headFatigueBar * 100)}%</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${headFatigueBar * 100}%` }}
            />
          </div>
        </div>

        {/* Hand Velocity bar */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between font-mono text-[7px] text-text-secondary">
            <span className="flex items-center gap-0.5">
              <Activity size={8} /> Hand (Vel: {signals.hand_velocity.toFixed(3)})
            </span>
            <span>{Math.round(handFatigueBar * 100)}%</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-green transition-all duration-300"
              style={{ width: `${handFatigueBar * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
