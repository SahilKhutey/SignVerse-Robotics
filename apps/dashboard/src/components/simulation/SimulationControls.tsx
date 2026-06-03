import React, { useEffect } from 'react';
import { useSimulationStore } from '../../store/simulation';
import { Play, Square, FlaskConical, Cpu, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SimulationControls() {
  const {
    isRunning,
    progress,
    selectedPolicy,
    episodeSteps,
    physicsStepMs,
    availablePolicies,
    availableSessions,
    compareSessionId,
    setSelectedPolicy,
    setEpisodeSteps,
    setPhysicsStepMs,
    setCompareSession,
    runSimulation,
    cancelSimulation,
    fetchPolicies,
    fetchSessions,
    fetchEpisodes,
    clearResults,
  } = useSimulationStore();

  useEffect(() => {
    fetchPolicies();
    fetchSessions();
    fetchEpisodes();
  }, [fetchPolicies, fetchSessions, fetchEpisodes]);

  const selectedPolicyObj = availablePolicies.find((p) => p.id === selectedPolicy);

  return (
    <div className="glass-panel p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2 select-none">
        <FlaskConical size={14} className="text-accent-cyan" />
        <span className="font-display text-[10px] font-bold tracking-widest text-text-primary uppercase">
          SIMULATION PARAMETERS
        </span>
      </div>

      {/* Policy Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-[8px] text-text-muted uppercase font-mono tracking-wider">
          BC Policy Checkpoint
        </label>
        <select
          disabled={isRunning}
          value={selectedPolicy ?? ''}
          onChange={(e) => setSelectedPolicy(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-sans text-text-primary focus:outline-none focus:border-accent-cyan w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <option value="" disabled>Select policy...</option>
          {availablePolicies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.accuracy.toFixed(1)}%
            </option>
          ))}
        </select>

        {/* Policy accuracy badge */}
        {selectedPolicyObj && (
          <div className="flex items-center gap-1.5 text-[9px] font-mono">
            <Cpu size={9} className="text-accent-violet" />
            <span className="text-text-muted">BC accuracy:</span>
            <span className={`font-bold ${
              selectedPolicyObj.accuracy > 88 ? 'text-accent-green' :
              selectedPolicyObj.accuracy > 80 ? 'text-amber-400' : 'text-accent-red'
            }`}>
              {selectedPolicyObj.accuracy.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Real Session Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-[8px] text-text-muted uppercase font-mono tracking-wider">
          Compare Against Real Session
        </label>
        <select
          disabled={isRunning}
          value={compareSessionId ?? ''}
          onChange={(e) => setCompareSession(e.target.value || null)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-sans text-text-primary focus:outline-none focus:border-accent-cyan w-full cursor-pointer disabled:opacity-50 transition-all"
        >
          <option value="">No comparison session</option>
          {availableSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.frameCount} frames)
            </option>
          ))}
        </select>
      </div>

      {/* Physics Parameters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 select-none">
          <SlidersHorizontal size={10} className="text-text-muted" />
          <span className="text-[8px] text-text-muted uppercase font-mono tracking-wider">Physics Config</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Episode Steps */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[8px] font-mono">
              <span className="text-text-muted uppercase">Steps</span>
              <span className="text-accent-cyan font-bold">{episodeSteps}</span>
            </div>
            <input
              type="range"
              min={50}
              max={500}
              step={50}
              value={episodeSteps}
              disabled={isRunning}
              onChange={(e) => setEpisodeSteps(Number(e.target.value))}
              className="w-full accent-[#00f0ff] cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[7px] font-mono text-text-muted">
              <span>50</span><span>500</span>
            </div>
          </div>

          {/* Physics Step */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[8px] font-mono">
              <span className="text-text-muted uppercase">Δt (ms)</span>
              <span className="text-accent-violet font-bold">{physicsStepMs}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={physicsStepMs}
              disabled={isRunning}
              onChange={(e) => setPhysicsStepMs(Number(e.target.value))}
              className="w-full accent-[#8b5cf6] cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[7px] font-mono text-text-muted">
              <span>1ms</span><span>10ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[8px] font-mono">
            <span className="text-text-muted animate-pulse">SIMULATING...</span>
            <span className="text-accent-cyan font-bold">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-violet"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={cancelSimulation}
            className="flex-1 flex items-center justify-center gap-2 bg-accent-red/20 hover:bg-accent-red/35 border border-accent-red/40 text-accent-red font-display text-[9px] font-bold px-4 py-2.5 rounded-lg tracking-widest transition-all"
          >
            <Square size={10} fill="currentColor" />
            CANCEL
          </button>
        ) : (
          <>
            <button
              onClick={runSimulation}
              disabled={!selectedPolicy}
              className="flex-1 flex items-center justify-center gap-2 bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/30 text-accent-cyan font-display text-[9px] font-bold px-4 py-2.5 rounded-lg tracking-widest transition-all shadow-[0_0_12px_rgba(0,240,255,0.1)] hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={10} fill="currentColor" />
              RUN SIMULATION
            </button>
            <button
              onClick={clearResults}
              className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-text-muted hover:text-text-secondary transition-all text-[9px] font-mono"
              title="Clear results"
            >
              CLR
            </button>
          </>
        )}
      </div>
    </div>
  );
}
