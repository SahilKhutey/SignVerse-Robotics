import React, { useState, useEffect, useRef } from 'react';
import { useRlhfStore } from '../store/rlhf';
import PreferenceComparisonView from '../components/learning/PreferenceComparisonView';
import AnnotationProgressCard from '../components/learning/AnnotationProgressCard';
import RMTrainingProgress from '../components/learning/RMTrainingProgress';
import PPORewardChart from '../components/learning/PPORewardChart';
import BehaviourComparisonView from '../components/learning/BehaviourComparisonView';
import { Heart, Settings, Sliders, Play, BrainCircuit, Terminal, Sparkles, UserCheck } from 'lucide-react';

export default function RLHFPage() {
  const [activeTab, setActiveTab] = useState<'annotator' | 'optimizer' | 'evaluator'>('annotator');
  const { isTraining, trainingLogs, startTraining, clearTrainingHistory, readyForTraining } = useRlhfStore();

  // Training parameters
  const [ppoSteps, setPpoSteps] = useState(50);
  const [klBeta, setKlBeta] = useState(0.1);

  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll training logs console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [trainingLogs.length]);

  const handleStartTraining = () => {
    clearTrainingHistory();
    startTraining(ppoSteps, klBeta);
  };

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6 bg-[#07080a]">
      {/* Page Header */}
      <div className="flex justify-between items-start select-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-accent-red animate-pulse" />
            <h2 className="font-display text-sm font-bold tracking-wider text-text-primary uppercase flex items-center gap-1">
              RLHF Feedback Studio
            </h2>
          </div>
          <p className="text-[10px] text-text-secondary">
            Align imitation learning behavior cloning policies with human intent via preference modeling and PPO fine-tuning.
          </p>
        </div>

        {/* Tab Selection buttons */}
        <div className="flex items-center bg-white/5 border border-white/5 p-1 rounded-xl">
          {[
            { id: 'annotator', label: 'Preferences Annotator', icon: UserCheck },
            { id: 'optimizer', label: 'PPO Optimizer', icon: BrainCircuit },
            { id: 'evaluator', label: 'Policy Benchmarks', icon: Sparkles }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-display font-semibold transition-all uppercase cursor-pointer ${
                  active 
                    ? 'bg-accent-cyan text-black font-bold shadow-[0_0_8px_rgba(0,240,255,0.2)]' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon size={10} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 min-h-0">
        {activeTab === 'annotator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <PreferenceComparisonView />
            </div>
            <div className="lg:col-span-1">
              <AnnotationProgressCard />
            </div>
          </div>
        )}

        {activeTab === 'optimizer' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Parameter controls and Console */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              {/* Controls */}
              <div className="glass-panel p-5 flex flex-col gap-4 select-none">
                <div className="flex items-center gap-1.5 text-text-primary border-b border-white/5 pb-2">
                  <Sliders size={13} className="text-accent-cyan" />
                  <span className="font-display text-[10px] font-bold tracking-widest uppercase">
                    PPO PARAMETERS
                  </span>
                </div>

                {/* Steps */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="text-text-muted">PPO STEPS</span>
                    <span className="text-accent-cyan font-bold">{ppoSteps}</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={10}
                    value={ppoSteps}
                    onChange={(e) => setPpoSteps(parseInt(e.target.value))}
                    disabled={isTraining}
                    className="w-full h-1 bg-black/40 accent-accent-cyan cursor-pointer"
                  />
                </div>

                {/* KL Beta */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="text-text-muted">KL PENALTY (BETA)</span>
                    <span className="text-accent-violet font-bold">{klBeta.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.01}
                    max={0.5}
                    step={0.01}
                    value={klBeta}
                    onChange={(e) => setKlBeta(parseFloat(e.target.value))}
                    disabled={isTraining}
                    className="w-full h-1 bg-black/40 accent-accent-violet cursor-pointer"
                  />
                </div>

                {/* Action button */}
                <button
                  onClick={handleStartTraining}
                  disabled={isTraining || !readyForTraining}
                  className={`w-full py-2.5 rounded-lg border font-display font-bold text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 select-none ${
                    isTraining 
                      ? 'bg-accent-cyan/10 border-accent-cyan/20 text-accent-cyan animate-pulse cursor-not-allowed'
                      : !readyForTraining
                        ? 'bg-black/40 border-white/5 text-text-muted cursor-not-allowed'
                        : 'bg-accent-cyan hover:bg-accent-cyan/80 text-black border-accent-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.3)] cursor-pointer active:scale-98'
                  }`}
                >
                  <Play size={10} />
                  {isTraining ? 'FINE-TUNING POLICY...' : 'START RLHF OPTIMIZATION'}
                </button>

                {!readyForTraining && (
                  <span className="text-center text-[8px] font-mono text-accent-red">
                    * Annotation threshold of 200 pairs required
                  </span>
                )}
              </div>

              {/* Console log display */}
              <div className="glass-panel p-5 flex flex-col gap-3 h-[250px] relative overflow-hidden">
                <div className="flex items-center gap-1.5 text-text-primary border-b border-white/5 pb-2">
                  <Terminal size={12} className="text-accent-cyan" />
                  <span className="font-display text-[9px] font-bold tracking-widest uppercase">
                    RLHF TRAINING CONSOLE
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto font-mono text-[9px] text-[#39ff14] flex flex-col gap-1 bg-black/50 p-3 rounded-lg border border-white/5">
                  {trainingLogs.length === 0 ? (
                    <span className="text-text-muted italic select-none">Console idle. Awaiting training trigger...</span>
                  ) : (
                    trainingLogs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed">
                        <span className="text-text-muted select-none">&gt;</span> {log}
                      </div>
                    ))
                  )}
                  <div ref={consoleEndRef} />
                </div>
              </div>
            </div>

            {/* Right Column: Reward Model Loss & PPO Improvement plots */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <RMTrainingProgress />
              <PPORewardChart />
            </div>
          </div>
        )}

        {activeTab === 'evaluator' && (
          <div className="w-full">
            <BehaviourComparisonView />
          </div>
        )}
      </div>
    </div>
  );
}
