import React, { useState, useEffect, useRef } from 'react';
import { useRlhfStore } from '../../store/rlhf';
import { VITE_API_URL } from '../../lib/env';
import RobotView from '../twin/RobotView';
import { Play, Pause, RotateCcw, Keyboard, Check, Loader2 } from 'lucide-react';
import { useNotificationsStore } from '../../store/notifications';

interface FrameData {
  action: number[];
}

export default function PreferenceComparisonView() {
  const { pair, submitPreference, isLoadingQueue, fetchQueue } = useRlhfStore();

  const [framesA, setFramesA] = useState<FrameData[]>([]);
  const [framesB, setFramesB] = useState<FrameData[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);

  // Playback Control States
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1.0 | 0.5 | 2.0>(1.0);

  // Timing stats for tracking duration
  const startTimeRef = useRef<number>(Date.now());

  // Load next queue item on mount
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Load frames when pair changes
  useEffect(() => {
    if (!pair) {
      setFramesA([]);
      setFramesB([]);
      return;
    }

    const loadFrames = async () => {
      setLoadingFrames(true);
      setIsPlaying(false);
      setPlaybackIndex(0);
      startTimeRef.current = Date.now();

      try {
        const fetchFrames = async (sessId: string) => {
          const res = await fetch(`${VITE_API_URL}/api/sessions/${sessId}/frames`, {
            headers: { 'X-API-Key': 'signverse_local_dev_key' }
          });
          const json = await res.json();
          return json.status === 'success' ? json.frames : [];
        };

        const [a, b] = await Promise.all([
          fetchFrames(pair.session_a.id),
          fetchFrames(pair.session_b.id)
        ]);

        setFramesA(a);
        setFramesB(b);
      } catch (err) {
        console.error('Failed to load comparison frames:', err);
        useNotificationsStore.getState().addLog('❌ Failed to fetch comparison frames', 'error');
      } finally {
        setLoadingFrames(false);
      }
    };

    loadFrames();
  }, [pair]);

  // Playback loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const maxLen = Math.max(framesA.length, framesB.length);

    if (isPlaying && maxLen > 0) {
      const intervalMs = Math.round(1000 / (60 * playbackSpeed));
      timer = setInterval(() => {
        setPlaybackIndex((prev) => (prev + 1) % maxLen);
      }, intervalMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, framesA.length, framesB.length, playbackSpeed]);

  // Keybindings listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pair || loadingFrames || isLoadingQueue) return;

      // Disable shortcuts if focus is in input boxes
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleVote('A');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleVote('B');
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleVote('draw');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pair, loadingFrames, isLoadingQueue, framesA, framesB]);

  const handleVote = (rating: 'A' | 'B' | 'draw') => {
    const durationMs = Date.now() - startTimeRef.current;
    submitPreference(rating, durationMs);
  };

  const maxFrames = Math.max(framesA.length, framesB.length);

  // Safely extract joint angles at current playback index
  const getAnglesAtIdx = (frames: FrameData[], idx: number): number[] => {
    if (frames.length === 0) return [0, 0, 0, 0, 0, 0, 0];
    const frameIdx = Math.min(idx, frames.length - 1);
    const f = frames[frameIdx];
    return f && f.action ? f.action : [0, 0, 0, 0, 0, 0, 0];
  };

  const anglesA = getAnglesAtIdx(framesA, playbackIndex);
  const anglesB = getAnglesAtIdx(framesB, playbackIndex);

  return (
    <div className="glass-panel p-5 flex flex-col gap-5 h-full relative">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center select-none gap-3 border-b border-white/5 pb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-display text-accent-cyan tracking-widest uppercase">RLHF FEEDBACK COLLECTOR</span>
          <span className="text-sm font-display font-bold text-text-primary uppercase">
            PAIR PREFERENCE ANNOTATOR
          </span>
        </div>

        {pair && (
          <div className="flex items-center gap-2 bg-black/40 border border-white/5 px-3 py-1 rounded-lg text-[9px] font-mono font-semibold text-text-secondary uppercase">
            <span>TASK: <span className="text-accent-violet font-bold">{pair.task_label}</span></span>
            <span className="text-white/10">|</span>
            <span>PAIR ID: <span className="text-text-primary">{pair.pair_id.substring(0, 8)}</span></span>
          </div>
        )}
      </div>

      {isLoadingQueue || loadingFrames ? (
        <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-accent-cyan animate-spin" />
          <span className="font-display text-[9px] tracking-widest text-text-muted uppercase font-bold">
            LOADING SESSION TRAJECTORIES...
          </span>
        </div>
      ) : !pair ? (
        <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center gap-3 text-center p-6 border border-dashed border-white/5 rounded-2xl bg-black/10 select-none">
          <Check size={28} className="text-accent-green bg-accent-green/10 border border-accent-green/20 p-1.5 rounded-full" />
          <h3 className="font-display text-xs font-bold text-text-primary uppercase tracking-wider">Preference Queue Cleared</h3>
          <p className="text-[10px] text-text-secondary max-w-xs mt-1 leading-relaxed">
            All available demonstration pairs have been labeled. The Reward Model dataset is fully complete and ready for training.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 flex-1">
          {/* Side-by-side Viewports */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RobotView 
              jointAngles={anglesA} 
              label="MOTION OPTION A" 
              badge={`Frames: ${framesA.length}`}
            />
            <RobotView 
              jointAngles={anglesB} 
              label="MOTION OPTION B" 
              badge={`Frames: ${framesB.length}`}
              isComparisonColor={true}
            />
          </div>

          {/* Timeline scrub bar */}
          <div className="flex flex-col gap-2 bg-black/20 p-3 rounded-lg border border-white/5">
            <input
              type="range"
              min={0}
              max={maxFrames > 0 ? maxFrames - 1 : 0}
              value={playbackIndex}
              onChange={(e) => setPlaybackIndex(parseInt(e.target.value, 10))}
              disabled={maxFrames === 0}
              className="w-full cursor-pointer accent-accent-cyan disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between items-center text-[9px] font-mono text-text-secondary select-none">
              <span>Frame: {playbackIndex} / {maxFrames > 0 ? maxFrames - 1 : 0}</span>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-text-primary transition-all cursor-pointer"
                >
                  {isPlaying ? <Pause size={10} /> : <Play size={10} />}
                </button>
                <button
                  onClick={() => setPlaybackIndex(0)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-text-primary transition-all cursor-pointer"
                >
                  <RotateCcw size={10} />
                </button>
              </div>

              {/* Speeds */}
              <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                {([0.5, 1.0, 2.0] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-1.5 py-0.2 rounded text-[7px] font-bold ${
                      playbackSpeed === spd ? 'bg-accent-cyan text-black' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feedback Rating Actions */}
          <div className="flex flex-col gap-3">
            <span className="text-center text-[9px] font-display font-semibold tracking-wider text-text-muted uppercase select-none">
              SELECT PREFERENCE DECISION
            </span>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleVote('A')}
                className="py-3 px-4 rounded-xl border border-accent-cyan/20 hover:border-accent-cyan/60 hover:bg-accent-cyan/10 transition-all font-display font-bold text-xs text-accent-cyan text-center cursor-pointer shadow-lg active:scale-98"
              >
                ← PREFER OPTION A
              </button>
              <button
                onClick={() => handleVote('draw')}
                className="py-3 px-4 rounded-xl border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all font-display font-bold text-xs text-text-secondary hover:text-text-primary text-center cursor-pointer shadow-lg active:scale-98"
              >
                [ SPACE ] TIE / CLOSE CALL
              </button>
              <button
                onClick={() => handleVote('B')}
                className="py-3 px-4 rounded-xl border border-accent-violet/20 hover:border-accent-violet/60 hover:bg-accent-violet/10 transition-all font-display font-bold text-xs text-accent-violet text-center cursor-pointer shadow-lg active:scale-98"
              >
                PREFER OPTION B →
              </button>
            </div>

            {/* Shortcut helpers */}
            <div className="flex items-center justify-center gap-1.5 text-text-muted select-none mt-1">
              <Keyboard size={12} />
              <span className="text-[8px] font-mono leading-none">
                HOTKEYS: LEFT ARROW (PREFER A) | RIGHT ARROW (PREFER B) | SPACEBAR (TIE)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
