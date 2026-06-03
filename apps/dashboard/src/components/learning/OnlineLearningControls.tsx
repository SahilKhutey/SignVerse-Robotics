import React from 'react';
import { useLearningStore } from '../../store/learning';
import { Sliders, AlertTriangle, Cpu, Save, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OnlineLearningControls() {
  const { step, learningRate, checkpointsCount, replayBufferSize, setLearningRate, fetchStatus } = useLearningStore();

  const handleLrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setLearningRate(value);
  };

  const isDangerZone = learningRate > 5e-4;

  return (
    <div className="glass-panel p-5 flex flex-col gap-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders size={14} className="text-accent-cyan" />
          <span className="font-display text-[10px] font-bold tracking-widest text-text-primary uppercase">
            ONLINE FINE-TUNING CONFIG
          </span>
        </div>
        <span className={`h-2 w-2 rounded-full ${isDangerZone ? 'bg-accent-red animate-pulse' : 'bg-accent-green'}`} />
      </div>

      {/* LR Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[9px] font-mono">
          <span className="text-text-muted uppercase">Learning Rate</span>
          <span className={`font-bold ${isDangerZone ? 'text-accent-red' : 'text-accent-cyan'}`}>
            {learningRate.toExponential(2)}
          </span>
        </div>
        <input
          type="range"
          min={1e-5}
          max={1e-3}
          step={1e-5}
          value={learningRate}
          onChange={handleLrChange}
          className={`w-full cursor-pointer h-1 rounded-lg appearance-none bg-black/40 accent-accent-cyan`}
        />
        <div className="flex justify-between text-[7px] font-mono text-text-muted">
          <span>1.0e-5</span>
          <span>5.0e-4 (Danger Limit)</span>
          <span>1.0e-3</span>
        </div>

        {/* Danger Warning */}
        {isDangerZone && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 bg-accent-red/10 border border-accent-red/30 p-3 rounded-lg text-accent-red text-[8px] font-mono leading-relaxed mt-1"
          >
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5 text-accent-red" />
            <p>
              <strong>DANGER ZONE ALERT:</strong> Learning rates above 5.0e-4 may destabilize Behavior Cloning weights and result in catastrophic model degradation. Use caution.
            </p>
          </motion.div>
        )}
      </div>

      {/* Online Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'ONLINE STEPS', value: step, icon: Cpu, color: 'text-accent-cyan' },
          { label: 'REPLAY CAPACITY', value: `${replayBufferSize}/500`, icon: RefreshCcw, color: 'text-accent-violet' },
          { label: 'CHECKPOINTS', value: checkpointsCount, icon: Save, color: 'text-accent-green' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white/5 border border-white/5 rounded-lg p-3 flex flex-col gap-1 items-center text-center">
            <div className="flex items-center gap-1.5 text-text-muted">
              <stat.icon size={10} />
              <span className="text-[7px] font-display tracking-widest uppercase">{stat.label}</span>
            </div>
            <span className={`text-xs font-bold font-mono ${stat.color} mt-1`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
