import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { TelemetryFrame, SimEpisode, DivergenceReport } from '@signverse/shared-types';
import { useNotificationsStore } from './notifications';
import { VITE_API_URL, VITE_WS_URL } from '../lib/env';
import { apiClient } from '../lib/apiClient';

// ─── Gap Metrics per joint ────────────────────────────────────────────────────
export interface JointGapMetric {
  joint: number;
  rmse: number;          // Root Mean Square Error (degrees)
  maxDeviation: number;  // Worst-case deviation (degrees)
  correlation: number;   // Pearson r, –1 to 1
  meanReal: number;      // Mean real angle
  meanSim: number;       // Mean sim angle
}

export interface SimGapSummary {
  overallScore: number;      // 0–100 composite sim-to-real score
  joints: JointGapMetric[];
  totalFrames: number;
  simDurationMs: number;
}

// ─── Simulation Store State ───────────────────────────────────────────────────
export interface SimulationState {
  // Status
  isRunning: boolean;
  isStreaming: boolean;
  jobId: string | null;
  error: string | null;
  progress: number; // 0–100

  // Policy config
  selectedPolicy: string | null;
  episodeSteps: number;
  physicsStepMs: number;
  availablePolicies: { id: string; name: string; accuracy: number }[];

  // Trajectory data
  simFrames: TelemetryFrame[];
  realFrames: TelemetryFrame[];

  // Gap analysis
  gapMetrics: SimGapSummary | null;
  divergenceReport: DivergenceReport | null;

  // Active comparison (which real session to compare against)
  compareSessionId: string | null;
  availableSessions: { id: string; label: string; frameCount: number }[];

  // Completed episodes
  completedEpisodes: SimEpisode[];

  // Actions
  setSelectedPolicy: (id: string) => void;
  setEpisodeSteps: (steps: number) => void;
  setPhysicsStepMs: (ms: number) => void;
  setCompareSession: (id: string | null) => void;
  runSimulation: () => Promise<void>;
  cancelSimulation: () => void;
  fetchPolicies: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchEpisodes: () => Promise<void>;
  fetchDivergence: (realId: string, simId: string) => Promise<void>;
  clearResults: () => void;
}

// ─── Gap metric computation ───────────────────────────────────────────────────
function computeGapMetrics(
  simFrames: TelemetryFrame[],
  realFrames: TelemetryFrame[]
): SimGapSummary {
  const N = Math.min(simFrames.length, realFrames.length);
  const numJoints = 7;
  const joints: JointGapMetric[] = [];

  for (let j = 0; j < numJoints; j++) {
    const simAngles: number[] = [];
    const realAngles: number[] = [];

    for (let i = 0; i < N; i++) {
      simAngles.push(simFrames[i]?.jointAngles?.[j] ?? 0);
      realAngles.push(realFrames[i]?.jointAngles?.[j] ?? 0);
    }

    // RMSE
    const squaredErrors = simAngles.map((s, i) => Math.pow(s - realAngles[i], 2));
    const rmse = Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / N);

    // Max deviation
    const maxDeviation = Math.max(...simAngles.map((s, i) => Math.abs(s - realAngles[i])));

    // Pearson correlation
    const meanSim = simAngles.reduce((a, b) => a + b, 0) / N;
    const meanReal = realAngles.reduce((a, b) => a + b, 0) / N;
    const cov = simAngles.reduce((acc, s, i) => acc + (s - meanSim) * (realAngles[i] - meanReal), 0) / N;
    const stdSim = Math.sqrt(simAngles.reduce((acc, s) => acc + Math.pow(s - meanSim, 2), 0) / N);
    const stdReal = Math.sqrt(realAngles.reduce((acc, r) => acc + Math.pow(r - meanReal, 2), 0) / N);
    const correlation = stdSim > 0 && stdReal > 0 ? cov / (stdSim * stdReal) : 0;

    joints.push({ joint: j, rmse, maxDeviation, correlation, meanReal, meanSim });
  }

  // Composite score: 100 = perfect, penalize RMSE and low correlation
  const avgRmse = joints.reduce((a, j) => a + j.rmse, 0) / numJoints;
  const avgCorr = joints.reduce((a, j) => a + j.correlation, 0) / numJoints;
  const rmseScore = Math.max(0, 100 - avgRmse * 2);       // 50deg RMSE → score 0
  const corrScore = ((avgCorr + 1) / 2) * 100;             // –1..1 → 0..100
  const overallScore = Math.round(rmseScore * 0.6 + corrScore * 0.4);

  return {
    overallScore,
    joints,
    totalFrames: N,
    simDurationMs: N * 16,
  };
}

// Map backend divergence report to frontend summary shape
function mapDivergenceReportToSummary(
  report: DivergenceReport,
  simFrames: TelemetryFrame[],
  realFrames: TelemetryFrame[]
): SimGapSummary {
  const joints: JointGapMetric[] = report.perJointRmse.map((rmseRad, j) => {
    // Convert radians RMSE to degrees RMSE
    const rmseDeg = rmseRad * 180.0 / Math.PI;

    // Calculate correlation/mean
    const N = Math.min(simFrames.length, realFrames.length);
    const simAngles = simFrames.map((f) => f.jointAngles?.[j] ?? 0);
    const realAngles = realFrames.map((f) => f.jointAngles?.[j] ?? 0);
    
    const meanSim = simAngles.length > 0 ? simAngles.reduce((a, b) => a + b, 0) / Math.max(1, N) : 0;
    const meanReal = realAngles.length > 0 ? realAngles.reduce((a, b) => a + b, 0) / Math.max(1, N) : 0;
    
    const cov = N > 0 ? simAngles.reduce((acc, s, i) => acc + (s - meanSim) * (realAngles[i] - meanReal), 0) / N : 0;
    const stdSim = N > 0 ? Math.sqrt(simAngles.reduce((acc, s) => acc + Math.pow(s - meanSim, 2), 0) / N) : 0;
    const stdReal = N > 0 ? Math.sqrt(realAngles.reduce((acc, r) => acc + Math.pow(r - meanReal, 2), 0) / N) : 0;
    const correlation = stdSim > 0 && stdReal > 0 ? cov / (stdSim * stdReal) : 0;

    const maxDeviation = simAngles.length > 0 ? Math.max(...simAngles.map((s, i) => Math.abs(s - (realAngles[i] ?? 0)))) : 0;

    return {
      joint: j,
      rmse: rmseDeg,
      maxDeviation,
      correlation,
      meanReal,
      meanSim
    };
  });

  // Divergence score: overallScore of report is 0 to 1 (smaller is better).
  // Map this to a 0-100 gauge (higher is better). 0.0 -> 100, >=1.0 -> 0.
  const overallScore = Math.max(0, Math.round(100 - report.overallScore * 100));

  return {
    overallScore,
    joints,
    totalFrames: Math.min(simFrames.length, realFrames.length),
    simDurationMs: Math.min(simFrames.length, realFrames.length) * 16
  };
}

// ─── Mock sim trajectory generator (fallback) ─────────────────────────────────
function generateMockSimFrames(
  realFrames: TelemetryFrame[],
  steps: number
): TelemetryFrame[] {
  const base = realFrames.length > 0 ? realFrames : [];
  const count = Math.min(steps, Math.max(100, base.length));
  const now = Date.now();

  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 4;
    const realAngles = base[i]?.jointAngles ?? [0, 0, 0, 0, 0, 0, 0];
    const drift = [
      Math.sin(t * 0.3) * 8,
      Math.cos(t * 0.5) * 6,
      Math.sin(t * 0.7) * 5,
      Math.cos(t * 0.4) * 4,
      Math.sin(t * 0.9) * 3,
      Math.cos(t * 0.6) * 2,
      Math.sin(t * 1.1) * 2,
    ];
    return {
      jointAngles: realAngles.map((r, j) => r + drift[j] + (Math.random() - 0.5) * 2),
      poseLandmarks: [],
      aiPrediction: realAngles,
      confidence: 0.85 - (i / count) * 0.2,
      timestampMs: now + i * 16,
    };
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useSimulationStore = create<SimulationState>()(
  subscribeWithSelector((set, get) => ({
    isRunning: false,
    isStreaming: false,
    jobId: null,
    error: null,
    progress: 0,

    selectedPolicy: null,
    episodeSteps: 200,
    physicsStepMs: 5,
    availablePolicies: [],

    simFrames: [],
    realFrames: [],
    gapMetrics: null,
    divergenceReport: null,
    compareSessionId: null,
    availableSessions: [],
    completedEpisodes: [],

    setSelectedPolicy: (selectedPolicy) => set({ selectedPolicy }),
    setEpisodeSteps: (episodeSteps) => set({ episodeSteps }),
    setPhysicsStepMs: (physicsStepMs) => set({ physicsStepMs }),
    setCompareSession: (compareSessionId) => set({ compareSessionId }),

    clearResults: () => set({
      simFrames: [],
      realFrames: [],
      gapMetrics: null,
      divergenceReport: null,
      error: null,
      progress: 0,
    }),

    fetchPolicies: async () => {
      try {
        const res = await fetch(`${VITE_API_URL}/api/training/models`, {
          headers: {
            'X-API-Key': 'signverse_local_dev_key'
          }
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (data.models?.length > 0) {
          const mapped = data.models.map((m: any) => ({
            id: m.version,
            name: m.version,
            accuracy: m.val_loss ? (1.0 - m.val_loss) * 100 : 90.0
          }));
          set({ availablePolicies: mapped, selectedPolicy: mapped[0]?.id || null });
          return;
        }
      } catch { /* fallback */ }

      // Mock policies fallback
      set({
        availablePolicies: [
          { id: 'bc_diffusion_v3', name: 'Diffusion Policy v3 (latest)', accuracy: 91.2 },
          { id: 'bc_act_v2', name: 'ACT Transformer v2', accuracy: 87.4 },
          { id: 'bc_resnet_v1', name: 'ResNet-BC Baseline', accuracy: 78.9 },
        ],
        selectedPolicy: 'bc_diffusion_v3',
      });
    },

    fetchSessions: async () => {
      try {
        const res = await fetch(`${VITE_API_URL}/api/sessions`, {
          headers: {
            'X-API-Key': 'signverse_local_dev_key'
          }
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (data.sessions?.length > 0) {
          set({ availableSessions: data.sessions });
          if (data.sessions[0]) set({ compareSessionId: data.sessions[0].id });
          return;
        }
      } catch { /* fallback */ }

      // Mock sessions fallback
      set({
        availableSessions: [
          { id: 'session_001', label: 'grasp_red_block_grasp.h5', frameCount: 248 },
          { id: 'session_002', label: 'wave_hand_custom.h5', frameCount: 184 },
          { id: 'session_003', label: 'reach_left_arm.h5', frameCount: 312 },
        ],
        compareSessionId: 'session_001',
      });
    },

    fetchEpisodes: async () => {
      try {
        const data = await apiClient.get<{ status: string; episodes: SimEpisode[] }>('/api/sim/episodes');
        if (data.status === 'success' && data.episodes) {
          set({ completedEpisodes: data.episodes });
        }
      } catch (err) {
        logger.error('Failed to fetch completed simulation episodes:', err);
      }
    },

    fetchDivergence: async (realId: string, simId: string) => {
      try {
        const data = await apiClient.get<{ status: string; report: DivergenceReport }>(
          `/api/sim/divergence?real_id=${realId}&sim_id=${simId}`
        );
        if (data.status === 'success' && data.report) {
          set({ divergenceReport: data.report });
        }
      } catch (err) {
        logger.error('Failed to fetch divergence report:', err);
      }
    },

    runSimulation: async () => {
      const { selectedPolicy, episodeSteps, compareSessionId, availableSessions } = get();

      if (!selectedPolicy) {
        set({ error: 'Select a policy checkpoint before running simulation.' });
        return;
      }

      set({ isRunning: true, isStreaming: true, error: null, progress: 0, simFrames: [], gapMetrics: null, divergenceReport: null });
      useNotificationsStore.getState().addLog(
        `🧪 Triggering backend MuJoCo simulation: policy=${selectedPolicy}, steps=${episodeSteps}`,
        'info'
      );

      // Fetch reference real frames
      let realFrames: TelemetryFrame[] = [];
      try {
        const sId = compareSessionId || 'session_001';
        const res = await fetch(`${VITE_API_URL}/api/sessions/${sId}/frames`, {
          headers: {
            'X-API-Key': 'signverse_local_dev_key'
          }
        });
        if (res.ok) {
          const body = await res.json();
          if (body.frames) {
            realFrames = body.frames.map((f: any) => ({
              jointAngles: f.action || [0,0,0,0,0,0,0],
              poseLandmarks: [],
              aiPrediction: f.expert || [0,0,0,0,0,0,0],
              confidence: f.reward || 1.0,
              timestampMs: f.ts ? f.ts * 1000 : Date.now()
            }));
            set({ realFrames });
          }
        }
      } catch (e) {
        logger.error('Failed to fetch reference real frames', e);
      }

      // If empty real frames, generate fallback
      if (realFrames.length === 0) {
        const session = availableSessions.find((s) => s.id === compareSessionId);
        const frameCount = session?.frameCount ?? 200;
        const now = Date.now();
        realFrames = Array.from({ length: frameCount }, (_, i) => {
          const t = (i / frameCount) * Math.PI * 3;
          return {
            jointAngles: [
              Math.sin(t) * 45, Math.cos(t) * 30, Math.sin(t * 1.5) * 20,
              Math.cos(t * 0.8) * 25, Math.sin(t * 2) * 15, Math.cos(t * 1.2) * 10, Math.sin(t * 0.5) * 5,
            ],
            poseLandmarks: [],
            aiPrediction: [],
            confidence: 0.92,
            timestampMs: now + i * 16,
          };
        });
        set({ realFrames });
      }

      try {
        // Call Python Backend api/sim/run
        const data = await apiClient.post<{ status: string; jobId: string }>('/api/sim/run', {
          model_version: selectedPolicy,
          episode_length: episodeSteps,
          real_session_id: compareSessionId || 'session_001'
        });

        if (data.status === 'started' && data.jobId) {
          const jobId = data.jobId;
          set({ jobId });

          // Establish WebSocket stream
          const wsProto = VITE_WS_URL.startsWith('https') ? 'wss' : 'ws';
          const host = VITE_WS_URL.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
          const wsUrl = `${wsProto}://${host}/ws/sim/stream?jobId=${jobId}`;
          const ws = new WebSocket(wsUrl);

          const streamedFrames: TelemetryFrame[] = [];

          ws.onmessage = async (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.error) {
                ws.close();
                set({ error: msg.error, isRunning: false, isStreaming: false });
                useNotificationsStore.getState().addLog(`❌ Sim error: ${msg.error}`, 'error');
                return;
              }
              if (msg.done) {
                ws.close();
                await finalizeResults(jobId, streamedFrames);
              } else if (msg.frame) {
                streamedFrames.push(msg.frame);
                set({ simFrames: [...streamedFrames], progress: msg.progress ?? 0 });
              }
            } catch (err) {
              /* Ignore parse errors */
            }
          };

          ws.onerror = async () => {
            ws.close();
            await finalizeResults(jobId, streamedFrames);
          };

          ws.onclose = async () => {
            await get().fetchEpisodes();
          };

          return;
        }
      } catch (err) {
        logger.error('Backend simulation request failed, falling back to mock.', err);
      }

      // Backend offline — generate deterministic mock sim frames
      await simulateMockProgress(get, set, episodeSteps, compareSessionId, availableSessions);

      async function finalizeResults(jobId: string, frames: TelemetryFrame[]) {
        try {
          // Fetch final divergence report from backend
          const sId = compareSessionId || 'session_001';
          const reportRes = await apiClient.get<{ status: string; report: DivergenceReport }>(
            `/api/sim/divergence?real_id=${sId}&sim_id=${jobId}`
          );

          if (reportRes.status === 'success' && reportRes.report) {
            const report = reportRes.report;
            const metrics = mapDivergenceReportToSummary(report, frames, get().realFrames);
            set({
              isRunning: false,
              isStreaming: false,
              progress: 100,
              divergenceReport: report,
              gapMetrics: metrics,
              simFrames: frames
            });

            const passesGate = report.overallScore < 0.3;
            useNotificationsStore.getState().addLog(
              `✅ Simulation complete: score ${metrics.overallScore}/100. Divergence score: ${report.overallScore.toFixed(3)} (${passesGate ? 'PASS' : 'FAIL'})`,
              passesGate ? 'success' : 'warn'
            );
            return;
          }
        } catch (e) {
          logger.error('Failed to fetch divergence report', e);
        }

        // Fallback calculation if report fetch fails
        const { realFrames: rF } = get();
        const metrics = computeGapMetrics(frames, rF);
        set({ isRunning: false, isStreaming: false, progress: 100, gapMetrics: metrics, simFrames: frames });
        useNotificationsStore.getState().addLog(
          `✅ Simulation complete: score ${metrics.overallScore}/100`,
          'success'
        );
      }
    },

    cancelSimulation: () => {
      set({ isRunning: false, isStreaming: false, progress: 0 });
      useNotificationsStore.getState().addLog('⏹️ Simulation cancelled.', 'warn');
    },
  }))
);

// logger placeholder mapping
const logger = {
  error: (msg: string, ...args: any[]) => console.error(`[SimulationStore] ${msg}`, ...args)
};

// ─── Mock simulation with animated progress ───────────────────────────────────
async function simulateMockProgress(
  get: () => SimulationState,
  set: (partial: Partial<SimulationState>) => void,
  steps: number,
  compareSessionId: string | null,
  availableSessions: { id: string; label: string; frameCount: number }[]
) {
  const session = availableSessions.find((s) => s.id === compareSessionId);
  const frameCount = session?.frameCount ?? 200;
  const now = Date.now();

  const realFrames: TelemetryFrame[] = Array.from({ length: frameCount }, (_, i) => {
    const t = (i / frameCount) * Math.PI * 3;
    return {
      jointAngles: [
        Math.sin(t) * 45, Math.cos(t) * 30, Math.sin(t * 1.5) * 20,
        Math.cos(t * 0.8) * 25, Math.sin(t * 2) * 15, Math.cos(t * 1.2) * 10, Math.sin(t * 0.5) * 5,
      ],
      poseLandmarks: [],
      aiPrediction: [],
      confidence: 0.92,
      timestampMs: now + i * 16,
    };
  });

  set({ realFrames });

  const CHUNKS = 20;
  const chunkSize = Math.ceil(steps / CHUNKS);
  const simFrames: TelemetryFrame[] = [];

  for (let chunk = 0; chunk < CHUNKS; chunk++) {
    if (!get().isRunning) break;

    await new Promise((r) => setTimeout(r, 60));

    const newFrames = generateMockSimFrames(realFrames, chunkSize);
    simFrames.push(...newFrames);
    const progress = Math.round(((chunk + 1) / CHUNKS) * 100);
    set({ simFrames: [...simFrames], progress });
  }

  const metrics = computeGapMetrics(simFrames, realFrames);
  
  // Calculate mock divergence report based on RMSE in radians
  const overallRmseRad = (metrics.joints.reduce((a, j) => a + j.rmse, 0) / 7.0) * Math.PI / 180.0;
  const mockReport: DivergenceReport = {
    realSessionId: compareSessionId || 'session_001',
    simEpisodeId: `mock_${Date.now()}`,
    perJointRmse: metrics.joints.map((j) => j.rmse * Math.PI / 180.0),
    overallScore: overallRmseRad,
    worstJointIndex: metrics.joints.reduce((acc, j, idx) => j.rmse > metrics.joints[acc].rmse ? idx : acc, 0)
  };

  set({
    isRunning: false,
    isStreaming: false,
    progress: 100,
    gapMetrics: metrics,
    simFrames,
    divergenceReport: mockReport
  });
  
  const passesGate = overallRmseRad < 0.3;
  useNotificationsStore.getState().addLog(
    `✅ Mock simulation complete: score ${metrics.overallScore}/100. Divergence score: ${overallRmseRad.toFixed(3)} (${passesGate ? 'PASS' : 'FAIL'})`,
    passesGate ? 'success' : 'warn'
  );
}
