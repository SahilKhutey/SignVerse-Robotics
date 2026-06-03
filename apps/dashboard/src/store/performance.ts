import { create } from 'zustand';

export interface PerformanceMetrics {
  wsConnectMs: number | null;
  twinFpsP50: number;
  commandLatencyMs: number | null;
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  commandLatencies: number[];
  fpsHistory: number[];
}

interface PerformanceState {
  metrics: PerformanceMetrics;
  updateMetric: <K extends keyof PerformanceMetrics>(key: K, value: PerformanceMetrics[K]) => void;
  recordCommandLatency: (latency: number) => void;
  recordFps: (fps: number) => void;
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  metrics: {
    wsConnectMs: null,
    twinFpsP50: 60,
    commandLatencyMs: null,
    lcp: null,
    fid: null,
    cls: null,
    commandLatencies: [],
    fpsHistory: Array.from({ length: 30 }, () => 60), // pre-fill with 60
  },
  updateMetric: (key, value) => set((state) => ({
    metrics: {
      ...state.metrics,
      [key]: value
    }
  })),
  recordCommandLatency: (latency) => set((state) => {
    const commandLatencies = [...state.metrics.commandLatencies, latency].slice(-10);
    return {
      metrics: {
        ...state.metrics,
        commandLatencyMs: latency,
        commandLatencies
      }
    };
  }),
  recordFps: (fps) => set((state) => {
    const fpsHistory = [...state.metrics.fpsHistory, fps].slice(-30);
    
    // Calculate p50 (median)
    const sorted = [...fpsHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const twinFpsP50 = sorted.length % 2 !== 0 
      ? sorted[mid] 
      : (sorted[mid - 1] + sorted[mid]) / 2;

    return {
      metrics: {
        ...state.metrics,
        twinFpsP50: Math.round(twinFpsP50),
        fpsHistory
      }
    };
  })
}));
