import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from '../store/telemetry';
import { useNotificationsStore } from '../store/notifications';
import { Play, Pause, RotateCcw, Activity, ArrowLeft, ArrowRight, Layers, Trash2 } from 'lucide-react';
import { VITE_API_URL } from '../lib/env';

interface SessionOption {
  id: string;
  label: string;
}

export default function PlaybackDeck() {
  const isPlaying = useTelemetryStore((state) => state.isPlaying);
  const setIsPlaying = useTelemetryStore((state) => state.setIsPlaying);
  
  const isReplayMode = useTelemetryStore((state) => state.isReplayMode);
  const setIsReplayMode = useTelemetryStore((state) => state.setIsReplayMode);
  const replayFrames = useTelemetryStore((state) => state.replayFrames);
  const activeReplaySessionId = useTelemetryStore((state) => state.activeReplaySessionId);
  const loadReplaySession = useTelemetryStore((state) => state.loadReplaySession);

  const comparisonFrames = useTelemetryStore((state) => state.comparisonFrames);
  const activeComparisonSessionId = useTelemetryStore((state) => state.activeComparisonSessionId);
  const loadComparisonSession = useTelemetryStore((state) => state.loadComparisonSession);

  const recordedFrames = useTelemetryStore((state) => state.recordedFrames);
  const playbackIndex = useTelemetryStore((state) => state.playbackIndex);
  const setPlaybackIndex = useTelemetryStore((state) => state.setPlaybackIndex);
  const playbackRate = useTelemetryStore((state) => state.playbackRate);
  const setPlaybackRate = useTelemetryStore((state) => state.setPlaybackRate);
  const clearRecording = useTelemetryStore((state) => state.clearRecording);

  const [sessionOptions, setSessionOptions] = useState<SessionOption[]>([]);

  // Query sessions from API for A/B overlay options
  useEffect(() => {
    const fetchSessionOptions = async () => {
      try {
        const response = await fetch(`${VITE_API_URL}/api/sessions`, {
          headers: { 'X-API-Key': 'signverse_local_dev_key' }
        });
        if (!response.ok) throw new Error('Offline');
        const data = await response.json();
        if (data.status === 'success') {
          setSessionOptions(data.sessions || []);
        }
      } catch (err) {
        // Mock options if offline
        setSessionOptions([
          { id: '1', label: 'grasp_red_block_grasp' },
          { id: '2', label: 'wave_hand_custom' }
        ]);
      }
    };
    fetchSessionOptions();
  }, [activeReplaySessionId]);

  const activeFrames = isReplayMode ? replayFrames : recordedFrames;
  const hasData = activeFrames.length > 0;

  // Playback timer loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying && activeFrames.length > 0) {
      // 60Hz default baseline rate * playback rate scaler
      const intervalMs = Math.round(1000 / (60 * playbackRate));
      timer = setInterval(() => {
        setPlaybackIndex((playbackIndex + 1) % activeFrames.length);
      }, intervalMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, playbackIndex, activeFrames.length, playbackRate]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaybackIndex(parseInt(e.target.value, 10));
  };

  const handleStepBack = () => {
    if (!hasData) return;
    setIsPlaying(false);
    const newIdx = (playbackIndex - 1 + activeFrames.length) % activeFrames.length;
    setPlaybackIndex(newIdx);
  };

  const handleStepForward = () => {
    if (!hasData) return;
    setIsPlaying(false);
    const newIdx = (playbackIndex + 1) % activeFrames.length;
    setPlaybackIndex(newIdx);
  };

  const handleComparisonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id === '') {
      loadComparisonSession(null);
    } else {
      loadComparisonSession(id);
    }
  };

  const handleExitReplay = () => {
    setIsPlaying(false);
    setIsReplayMode(false);
    loadComparisonSession(null);
    setPlaybackIndex(0);
    useNotificationsStore.getState().addLog('Exited replay mode. Switched back to Live Teleoperation Telemetry.', 'info');
  };

  const formattedTime = (frameIndex: number) => {
    const totalSecs = frameIndex * 0.016; // 60Hz approximation
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    const ms = Math.floor((totalSecs % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`glass-panel p-5 flex flex-col gap-4 border transition-all duration-300 ${
      isReplayMode ? 'border-accent-cyan/40 bg-accent-cyan/5 shadow-[0_0_12px_rgba(0,240,255,0.05)]' : 'border-white/5'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <Activity size={18} className={isReplayMode ? 'text-accent-cyan animate-pulse' : 'text-accent-cyan'} />
          <h2 className="font-display text-sm font-semibold tracking-wider text-text-primary uppercase">
            {isReplayMode ? 'TELEMETRY REPLAY ACTIVE' : 'MOTION REPLAY DECK'}
          </h2>
        </div>
        <span className="text-[10px] text-text-muted font-mono bg-black/40 px-2 py-0.5 rounded border border-white/5">
          {isReplayMode ? `Session: ${activeReplaySessionId?.substring(0, 8)}` : `Recorded Cache: ${recordedFrames.length}f`}
        </span>
      </div>

      {/* Replay Banner Alert */}
      {isReplayMode && (
        <div className="bg-black/60 border border-accent-cyan/20 p-2.5 rounded-lg flex justify-between items-center select-none animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-accent-cyan tracking-wider font-mono">REPLAY ENVIRONMENT CONTROL</span>
            <span className="text-[8px] text-text-secondary">Console state outputs driven by database frames.</span>
          </div>
          <button
            onClick={handleExitReplay}
            className="px-2 py-1 rounded bg-accent-cyan/15 hover:bg-accent-cyan/35 border border-accent-cyan/30 text-[8px] font-display font-semibold tracking-wider text-accent-cyan transition-all cursor-pointer"
          >
            EXIT REPLAY
          </button>
        </div>
      )}

      {/* Scrub bar */}
      <div className="flex flex-col gap-2">
        <input
          type="range"
          min={0}
          max={hasData ? activeFrames.length - 1 : 0}
          value={playbackIndex}
          onChange={handleSliderChange}
          disabled={!hasData}
          className="w-full accent-accent-cyan cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-[10px] text-text-secondary font-mono select-none">
          <span>{formattedTime(playbackIndex)}</span>
          <span className="text-text-primary font-bold">
            Frame: {playbackIndex} / {hasData ? activeFrames.length - 1 : 0}
          </span>
          <span>{formattedTime(hasData ? activeFrames.length - 1 : 0)}</span>
        </div>
      </div>

      {/* Controls panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Play/Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!hasData}
            className={`px-3 py-1.5 rounded-lg border font-display font-semibold text-[10px] tracking-wider transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95 ${
              isPlaying 
                ? 'bg-accent-cyan text-black border-accent-cyan shadow-[0_0_8px_rgba(0,240,255,0.25)] font-bold' 
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-text-primary'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isPlaying ? <Pause size={10} /> : <Play size={10} />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>

          {/* Reset */}
          <button
            onClick={() => setPlaybackIndex(0)}
            disabled={!hasData}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary hover:text-text-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset to frame 0"
          >
            <RotateCcw size={10} />
          </button>

          {/* Step Back */}
          <button
            onClick={handleStepBack}
            disabled={!hasData}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary hover:text-text-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Step Back (1 frame)"
          >
            <ArrowLeft size={10} />
          </button>

          {/* Step Forward */}
          <button
            onClick={handleStepForward}
            disabled={!hasData}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary hover:text-text-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Step Forward (1 frame)"
          >
            <ArrowRight size={10} />
          </button>

          {/* Flush (Only for live recording cache) */}
          {!isReplayMode && (
            <button
              onClick={clearRecording}
              disabled={!hasData}
              className="p-1.5 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red hover:bg-accent-red/25 hover:border-accent-red/40 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Flush Cache"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>

        {/* Playback Rate */}
        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-md border border-white/5 select-none">
          {([0.5, 1.0, 2.0] as const).map((rate) => (
            <button
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              disabled={!hasData}
              className={`px-2 py-0.5 rounded text-[9px] font-display font-semibold transition-all cursor-pointer ${
                playbackRate === rate
                  ? 'bg-accent-cyan text-black font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* A/B Comparison Overlay Module */}
      {isReplayMode && hasData && (
        <div className="flex flex-col gap-2 bg-black/30 border border-white/5 p-3 rounded-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 select-none">
            <Layers size={10} className="text-accent-cyan" />
            <span className="text-[9px] font-bold text-text-primary uppercase tracking-wide">
              A/B Ghost Twin Comparison Overlay
            </span>
          </div>

          <div className="flex gap-2 items-center">
            <select
              value={activeComparisonSessionId || ''}
              onChange={handleComparisonChange}
              className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] text-text-secondary hover:text-text-primary focus:outline-none focus:border-accent-cyan font-mono"
            >
              <option value="">(No Comparison Overlay)</option>
              {sessionOptions
                .filter((opt) => opt.id !== activeReplaySessionId)
                .map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}.h5
                  </option>
                ))}
            </select>

            {activeComparisonSessionId && (
              <span className="px-2 py-0.5 rounded bg-accent-violet/15 border border-accent-violet/30 text-[7px] font-bold font-mono text-accent-violet animate-pulse select-none">
                GHOST ACTIVE
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
