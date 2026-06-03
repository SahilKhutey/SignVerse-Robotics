import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { VITE_API_URL, VITE_WS_URL } from '../lib/env';
import { apiClient } from '../lib/apiClient';
import { useNotificationsStore } from './notifications';

export interface RlhfSession {
  id: string;
  label: string;
  frame_count: number;
}

export interface PreferencePair {
  pair_id: string;
  task_label: string;
  session_a: RlhfSession;
  session_b: RlhfSession;
  rated_count: number;
  target_ready_count: number;
  progress_percent: number;
}

export interface RMEpochData {
  epoch: number;
  train_loss: number;
  val_loss: number;
}

export interface PPOMetricData {
  step: number;
  ppo_loss: number;
  ppo_reward: number;
  kl_divergence: number;
}

export interface RlhfState {
  // Annotator State
  pair: PreferencePair | null;
  ratedCount: number;
  targetReadyCount: number;
  progressPercent: number;
  estimatedHoursRemaining: number;
  streakDays: number;
  readyForTraining: boolean;
  isLoadingQueue: boolean;

  // Training State
  isTraining: boolean;
  rmHistory: RMEpochData[];
  ppoHistory: PPOMetricData[];
  trainingLogs: string[];

  // Actions
  fetchQueue: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  submitPreference: (rating: 'A' | 'B' | 'draw', durationMs: number) => Promise<void>;
  startTraining: (ppoSteps?: number, klBeta?: number) => Promise<void>;
  connectRlhfEvents: () => void;
  disconnectRlhfEvents: () => void;
  clearTrainingHistory: () => void;
}

let wsConnection: WebSocket | null = null;

export const useRlhfStore = create<RlhfState>()(
  subscribeWithSelector((set, get) => ({
    pair: null,
    ratedCount: 0,
    targetReadyCount: 200,
    progressPercent: 0,
    estimatedHoursRemaining: 0,
    streakDays: 0,
    readyForTraining: false,
    isLoadingQueue: false,

    isTraining: false,
    rmHistory: [],
    ppoHistory: [],
    trainingLogs: [],

    fetchQueue: async () => {
      set({ isLoadingQueue: true });
      try {
        const data = await apiClient.get<any>('/api/rlhf/preference_queue');
        if (data.status === 'success') {
          set({
            pair: {
              pair_id: data.pair_id,
              task_label: data.task_label,
              session_a: data.session_a,
              session_b: data.session_b,
              rated_count: data.rated_count,
              target_ready_count: data.target_ready_count,
              progress_percent: data.progress_percent
            },
            ratedCount: data.rated_count,
            targetReadyCount: data.target_ready_count,
            progressPercent: data.progress_percent
          });
        }
      } catch (err) {
        console.error('Failed to fetch preference pair:', err);
      } finally {
        set({ isLoadingQueue: false });
      }
    },

    fetchStatus: async () => {
      try {
        const data = await apiClient.get<any>('/api/rlhf/preference_status');
        if (data.status === 'success') {
          set({
            ratedCount: data.rated_count,
            targetReadyCount: data.target_ready_count,
            estimatedHoursRemaining: data.estimated_hours_remaining,
            streakDays: data.streak_days,
            readyForTraining: data.ready_for_training,
            progressPercent: minMax((data.rated_count / data.target_ready_count) * 100)
          });
        }
      } catch (err) {
        console.error('Failed to fetch preference status:', err);
      }
    },

    submitPreference: async (rating, durationMs) => {
      const activePair = get().pair;
      if (!activePair) return;

      try {
        const payload = {
          session_a_id: activePair.session_a.id,
          session_b_id: activePair.session_b.id,
          rating,
          duration_ms: durationMs
        };

        const res = await apiClient.post<any>('/api/rlhf/preference', payload);
        if (res.status === 'success') {
          useNotificationsStore.getState().addLog(
            `🗳️ Rating recorded: Session ${rating === 'A' ? 'A preferred' : rating === 'B' ? 'B preferred' : 'Tie'} (Annotated in ${(durationMs / 1000).toFixed(1)}s)`,
            'success'
          );
          // Reload status and fetch next queue item
          await get().fetchStatus();
          await get().fetchQueue();
        }
      } catch (err) {
        console.error('Failed to submit preference rating:', err);
        useNotificationsStore.getState().addLog('❌ Failed to save preference rating', 'error');
      }
    },

    startTraining: async (ppoSteps = 50, klBeta = 0.1) => {
      try {
        set({ isTraining: true, rmHistory: [], ppoHistory: [], trainingLogs: [] });
        const res = await apiClient.post<any>('/api/rlhf/train', { ppo_steps: ppoSteps, kl_beta: klBeta });
        if (res.status === 'success') {
          useNotificationsStore.getState().addLog('🚀 RLHF training spawned successfully!', 'success');
          get().connectRlhfEvents();
        } else {
          set({ isTraining: false });
        }
      } catch (err) {
        set({ isTraining: false });
        console.error('Failed to start RLHF training:', err);
        useNotificationsStore.getState().addLog('❌ Failed to start RLHF training', 'error');
      }
    },

    connectRlhfEvents: () => {
      if (wsConnection) return;

      const wsProto = VITE_WS_URL.startsWith('https') ? 'wss' : 'ws';
      const host = VITE_WS_URL.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
      const wsUrl = `${wsProto}://${host}/ws/rlhf_events`;

      wsConnection = new WebSocket(wsUrl);

      wsConnection.onopen = () => {
        set({ isTraining: true });
        set((state) => ({ trainingLogs: [...state.trainingLogs, '📡 Connected to RLHF training socket.'] }));
      };

      wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.event === 'rm_progress') {
            const { epoch, train_loss, val_loss } = data;
            set((state) => ({
              rmHistory: [...state.rmHistory, { epoch, train_loss, val_loss }],
              trainingLogs: [
                ...state.trainingLogs,
                `[RM Epoch ${epoch}] loss: ${train_loss.toFixed(4)}, val_loss: ${val_loss.toFixed(4)}`
              ]
            }));
          } else if (data.event === 'ppo_progress') {
            const { step, ppo_loss, ppo_reward, kl_divergence } = data;
            set((state) => ({
              ppoHistory: [...state.ppoHistory, { step, ppo_loss, ppo_reward, kl_divergence }],
              trainingLogs: [
                ...state.trainingLogs,
                `[PPO Step ${step}] reward: ${ppo_reward.toFixed(4)}, loss: ${ppo_loss.toFixed(4)}, kl: ${kl_divergence.toFixed(4)}`
              ]
            }));
          } else if (data.event === 'aborted') {
            const { message, step, kl_divergence } = data;
            set((state) => ({
              isTraining: false,
              trainingLogs: [
                ...state.trainingLogs,
                `⚠️ ABORTED: ${message} (Step ${step}, KL: ${kl_divergence.toFixed(4)})`
              ]
            }));
            useNotificationsStore.getState().addLog(`⚠️ RLHF Training Aborted: ${message}`, 'error');
            get().disconnectRlhfEvents();
          } else if (data.event === 'complete') {
            const { status, message } = data;
            set((state) => ({
              isTraining: false,
              trainingLogs: [
                ...state.trainingLogs,
                status === 'success' ? `🏆 COMPLETE: ${message}` : `❌ FAILED: ${message}`
              ]
            }));
            if (status === 'success') {
              useNotificationsStore.getState().addLog('🏆 RLHF Fine-tuning completed successfully!', 'success');
            } else {
              useNotificationsStore.getState().addLog(`❌ RLHF Fine-tuning failed: ${message}`, 'error');
            }
            get().disconnectRlhfEvents();
          }
        } catch (err) {
          // ignore parsing error
        }
      };

      wsConnection.onerror = () => {
        set({ isTraining: false });
      };

      wsConnection.onclose = () => {
        wsConnection = null;
        set({ isTraining: false });
      };
    },

    disconnectRlhfEvents: () => {
      if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
      }
      set({ isTraining: false });
    },

    clearTrainingHistory: () => {
      set({ rmHistory: [], ppoHistory: [], trainingLogs: [] });
    }
  }))
);

function minMax(val: number): number {
  return Math.max(0, Math.min(100, val));
}
