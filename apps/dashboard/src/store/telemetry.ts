import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { TelemetryFrame } from '@signverse/shared-types';
import { useNotificationsStore } from './notifications';
import { VITE_API_URL } from '../lib/env';

export interface TelemetryState {
  // Connection and telemetry frame rates
  frame: TelemetryFrame | null;
  wsState: 'IDLE' | 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'DEAD';
  hz: number;

  // Fleet management
  activeRobotId: string;
  connectedRobots: string[];

  // Data collection deck
  isRecording: boolean;
  recordedFrames: TelemetryFrame[];
  sessionLabel: string;

  // Playback deck
  isPlaying: boolean;
  playbackIndex: number;
  playbackRate: number;

  // Advanced Replay Engine
  isReplayMode: boolean;
  replayFrames: TelemetryFrame[];
  activeReplaySessionId: string | null;
  comparisonFrames: TelemetryFrame[];
  activeComparisonSessionId: string | null;
  heatmapActive: boolean;
  anomalyActive: boolean;

  // E-Stop control
  isEstopTriggered: boolean;
  isTwinFrozen: boolean;

  // Actions
  setFrame: (frame: TelemetryFrame | null) => void;
  setWsState: (wsState: 'IDLE' | 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'DEAD') => void;
  setHz: (hz: number) => void;
  setActiveRobot: (id: string) => void;
  setEstop: (triggered: boolean) => void;
  setIsTwinFrozen: (frozen: boolean) => void;

  // Recording Actions
  startRecording: (label: string) => void;
  stopRecording: () => void;
  clearRecording: () => void;
  annotateFrame: (annotation: string) => void;

  // Playback Actions
  setIsPlaying: (isPlaying: boolean) => void;
  setPlaybackIndex: (idx: number) => void;
  setPlaybackRate: (rate: number) => void;

  // Advanced Replay Actions
  setIsReplayMode: (active: boolean) => void;
  setReplayFrames: (frames: TelemetryFrame[]) => void;
  setActiveReplaySessionId: (id: string | null) => void;
  setComparisonFrames: (frames: TelemetryFrame[]) => void;
  setActiveComparisonSessionId: (id: string | null) => void;
  setHeatmapActive: (active: boolean) => void;
  setAnomalyActive: (active: boolean) => void;
  loadReplaySession: (id: string) => Promise<void>;
  loadComparisonSession: (id: string | null) => Promise<void>;

  // un-throttled raw reference query
  getRawFrame: () => TelemetryFrame | null;
}

// Module-level reference holding 1000Hz raw telemetry inputs
export const rawTelemetryRef = {
  current: null as TelemetryFrame | null
};

export const useTelemetryStore = create<TelemetryState>()(
  subscribeWithSelector((set, get) => ({
    frame: null,
    wsState: 'IDLE',
    hz: 0,

    activeRobotId: 'signverse-robot-01',
    connectedRobots: ['signverse-robot-01', 'signverse-robot-02'],

    isRecording: false,
    recordedFrames: [],
    sessionLabel: 'teleop_session_01',

    isPlaying: false,
    playbackIndex: 0,
    playbackRate: 1.0,

    // Advanced Replay Engine initial states
    isReplayMode: false,
    replayFrames: [],
    activeReplaySessionId: null,
    comparisonFrames: [],
    activeComparisonSessionId: null,
    heatmapActive: false,
    anomalyActive: false,

    isEstopTriggered: false,
    isTwinFrozen: false,

    setFrame: (frame) => {
      set((state) => {
        const updatedFrames = state.isRecording && frame
          ? [...state.recordedFrames, frame]
          : state.recordedFrames;

        return {
          frame,
          recordedFrames: updatedFrames
        };
      });
    },

    setWsState: (wsState) => set({ wsState }),
    
    setHz: (hz) => set({ hz }),

    setActiveRobot: (activeRobotId) => {
      set({ activeRobotId });
      useNotificationsStore.getState().addLog(
        `Switched active node to ${activeRobotId}`,
        'info'
      );
    },

    setEstop: (triggered) => {
      set({ 
        isEstopTriggered: triggered,
        // Sync E-Stop safety state
        frame: get().frame ? {
          ...get().frame!,
          confidence: triggered ? 0 : get().frame!.confidence
        } : null
      });

      useNotificationsStore.getState().addLog(
        triggered
          ? '⚠️ E-STOP ACTIVATED: Robotic joint motors locked. Braking engagement successful.'
          : '🟢 E-STOP CLEARED: Re-enabling robotic joint drivers.',
        triggered ? 'error' : 'success'
      );
    },

    setIsTwinFrozen: (isTwinFrozen) => set({ isTwinFrozen }),

    // Recording Actions
    startRecording: (sessionLabel) => {
      set({
        isRecording: true,
        sessionLabel,
        recordedFrames: []
      });
      useNotificationsStore.getState().addLog(
        `🔴 Teleoperation Recording Started: [${sessionLabel}]`,
        'warn'
      );
    },

    stopRecording: () => {
      const state = get();
      set({ isRecording: false });
      useNotificationsStore.getState().addLog(
        `💾 Teleoperation Recording Saved: [${state.sessionLabel}] with ${state.recordedFrames.length} frames.`,
        'success'
      );
    },

    clearRecording: () => {
      const state = get();
      set({ recordedFrames: [] });
      useNotificationsStore.getState().addLog(
        `Flushed recorded cache for [${state.sessionLabel}]`,
        'info'
      );
    },

    annotateFrame: (annotation) => {
      useNotificationsStore.getState().addLog(
        `📝 Frame Annotation added: "${annotation}"`,
        'info'
      );
    },

    // Playback Actions
    setIsPlaying: (isPlaying) => {
      set({ isPlaying });
      useNotificationsStore.getState().addLog(
        isPlaying ? '▶️ Motion playback started' : '⏸️ Motion playback paused',
        'info'
      );
    },

    setPlaybackIndex: (playbackIndex) => set({ playbackIndex }),

    setPlaybackRate: (playbackRate) => set({ playbackRate }),

    // Advanced Replay Actions
    setIsReplayMode: (isReplayMode) => set({ isReplayMode }),
    setReplayFrames: (replayFrames) => set({ replayFrames }),
    setActiveReplaySessionId: (activeReplaySessionId) => set({ activeReplaySessionId }),
    setComparisonFrames: (comparisonFrames) => set({ comparisonFrames }),
    setActiveComparisonSessionId: (activeComparisonSessionId) => set({ activeComparisonSessionId }),
    setHeatmapActive: (heatmapActive) => set({ heatmapActive }),
    setAnomalyActive: (anomalyActive) => set({ anomalyActive }),

    loadReplaySession: async (id) => {
      try {
        const response = await fetch(`${VITE_API_URL}/api/sessions/${id}/frames`, {
          headers: { 'X-API-Key': 'signverse_local_dev_key' }
        });
        if (!response.ok) throw new Error('Failed to load frames');
        const data = await response.json();
        if (data.status === 'success') {
          const mappedFrames: TelemetryFrame[] = data.frames.map((f: any) => ({
            jointAngles: f.action,
            poseLandmarks: f.obs ? f.obs.map((pt: any) => ({ x: pt.x || 0, y: pt.y || 0, z: pt.z || 0, visibility: pt.visibility || 1 })) : [],
            aiPrediction: f.expert || [0, 0, 0, 0, 0, 0, 0],
            confidence: f.reward || 0.95,
            timestampMs: f.ts * 1000
          }));

          set({
            isReplayMode: true,
            replayFrames: mappedFrames,
            activeReplaySessionId: id,
            playbackIndex: 0,
            isPlaying: false
          });

          useNotificationsStore.getState().addLog(
            `📂 Loaded Replay Session [${id}] with ${mappedFrames.length} frames`,
            'success'
          );
        }
      } catch (err) {
        console.warn('Backend offline, using generated mock frames for replay');
        // Generate mock frames if backend is offline
        const mockFrames: TelemetryFrame[] = [];
        const now = Date.now();
        for (let i = 0; i < 200; i++) {
          const t = i * 0.05;
          const q = [Math.sin(t) * 45, Math.cos(t) * 30, Math.sin(t * 2) * 15, 0, 0, 0, 0];
          mockFrames.push({
            jointAngles: q,
            poseLandmarks: [],
            aiPrediction: q,
            confidence: 0.95,
            timestampMs: now + i * 16
          });
        }
        set({
          isReplayMode: true,
          replayFrames: mockFrames,
          activeReplaySessionId: id,
          playbackIndex: 0,
          isPlaying: false
        });
        useNotificationsStore.getState().addLog(
          `📂 Loaded Mock Replay Session [${id}] with ${mockFrames.length} frames (fallback)`,
          'warn'
        );
      }
    },

    loadComparisonSession: async (id) => {
      if (!id) {
        set({
          activeComparisonSessionId: null,
          comparisonFrames: []
        });
        useNotificationsStore.getState().addLog('Cleared comparison A/B session overlay.', 'info');
        return;
      }
      try {
        const response = await fetch(`${VITE_API_URL}/api/sessions/${id}/frames`, {
          headers: { 'X-API-Key': 'signverse_local_dev_key' }
        });
        if (!response.ok) throw new Error('Failed to load frames');
        const data = await response.json();
        if (data.status === 'success') {
          const mappedFrames: TelemetryFrame[] = data.frames.map((f: any) => ({
            jointAngles: f.action,
            poseLandmarks: f.obs ? f.obs.map((pt: any) => ({ x: pt.x || 0, y: pt.y || 0, z: pt.z || 0, visibility: pt.visibility || 1 })) : [],
            aiPrediction: f.expert || [0, 0, 0, 0, 0, 0, 0],
            confidence: f.reward || 0.95,
            timestampMs: f.ts * 1000
          }));

          set({
            comparisonFrames: mappedFrames,
            activeComparisonSessionId: id
          });

          useNotificationsStore.getState().addLog(
            `⚖️ Loaded A/B Comparison Session [${id}] with ${mappedFrames.length} frames`,
            'success'
          );
        }
      } catch (err) {
        console.warn('Backend offline, using generated mock frames for comparison');
        const mockFrames: TelemetryFrame[] = [];
        const now = Date.now();
        for (let i = 0; i < 200; i++) {
          const t = i * 0.05;
          const q = [Math.cos(t) * 40, Math.sin(t) * 25, Math.cos(t * 2) * 10, 0, 0, 0, 0];
          mockFrames.push({
            jointAngles: q,
            poseLandmarks: [],
            aiPrediction: q,
            confidence: 0.92,
            timestampMs: now + i * 16
          });
        }
        set({
          comparisonFrames: mockFrames,
          activeComparisonSessionId: id
        });
        useNotificationsStore.getState().addLog(
          `⚖️ Loaded Mock Comparison Session [${id}] with ${mockFrames.length} frames (fallback)`,
          'warn'
        );
      }
    },

    // un-throttled query getter
    getRawFrame: () => rawTelemetryRef.current
  }))
);
