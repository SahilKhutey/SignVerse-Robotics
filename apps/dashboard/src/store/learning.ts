import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { VITE_API_URL, VITE_WS_URL } from '../lib/env';
import { apiClient } from '../lib/apiClient';
import { useNotificationsStore } from './notifications';

export interface ReplayDemo {
  id: string;
  label: string;
  divergenceScore: number;
  highlighted: boolean;
}

export interface SparklinePoint {
  step: number;
  accuracy: number;
}

export interface LearningState {
  // Status
  step: number;
  learningRate: number;
  replayBufferSize: number;
  checkpointsCount: number;
  forgettingAlerts: string[];
  isRunning: boolean;

  // Visualizer data
  demos: ReplayDemo[];
  accuracyHistory: SparklinePoint[];
  taskAccuracies: Record<string, [number, number][]>;

  // Actions
  fetchStatus: () => Promise<void>;
  fetchReplayBuffer: () => Promise<void>;
  fetchForgettingMonitor: () => Promise<void>;
  setLearningRate: (lr: number) => Promise<void>;
  connectLearningEvents: () => void;
  disconnectLearningEvents: () => void;
}

let wsConnection: WebSocket | null = null;

export const useLearningStore = create<LearningState>()(
  subscribeWithSelector((set, get) => ({
    step: 0,
    learningRate: 1e-4,
    replayBufferSize: 0,
    checkpointsCount: 0,
    forgettingAlerts: [],
    isRunning: false,

    demos: [],
    accuracyHistory: [],
    taskAccuracies: {},

    fetchStatus: async () => {
      try {
        const data = await apiClient.get<any>('/api/learning/status');
        if (data.status === 'success') {
          set({
            step: data.step,
            learningRate: data.learning_rate,
            replayBufferSize: data.replay_buffer_size,
            checkpointsCount: data.checkpoints_count,
            forgettingAlerts: data.forgetting_alerts || [],
          });
        }
      } catch (err) {
        console.error('Failed to fetch learning status:', err);
      }
    },

    fetchReplayBuffer: async () => {
      try {
        const data = await apiClient.get<{ status: string; demos: ReplayDemo[] }>('/api/learning/replay_buffer');
        if (data.status === 'success' && data.demos) {
          set({ demos: data.demos });
        }
      } catch (err) {
        console.error('Failed to fetch replay buffer:', err);
      }
    },

    fetchForgettingMonitor: async () => {
      try {
        const data = await apiClient.get<{ status: string; task_accuracies: Record<string, [number, number][]>; alerts: string[] }>(
          '/api/learning/forgetting_monitor'
        );
        if (data.status === 'success') {
          set({
            taskAccuracies: data.task_accuracies || {},
            forgettingAlerts: data.alerts || []
          });
        }
      } catch (err) {
        console.error('Failed to fetch forgetting metrics:', err);
      }
    },

    setLearningRate: async (lr: number) => {
      try {
        const data = await apiClient.post<any>('/api/learning/lr', { lr });
        if (data.status === 'success') {
          set({ learningRate: lr });
          useNotificationsStore.getState().addLog(`⚙️ Online learning rate set to ${lr}`, 'info');
        }
      } catch (err) {
        console.error('Failed to update learning rate:', err);
        useNotificationsStore.getState().addLog('❌ Failed to update learning rate', 'error');
      }
    },

    connectLearningEvents: () => {
      if (wsConnection) return;

      const wsProto = VITE_WS_URL.startsWith('https') ? 'wss' : 'ws';
      const host = VITE_WS_URL.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
      const wsUrl = `${wsProto}://${host}/ws/learning_events`;

      wsConnection = new WebSocket(wsUrl);

      wsConnection.onopen = () => {
        set({ isRunning: true });
        useNotificationsStore.getState().addLog('📡 Connected to online learning events', 'success');
      };

      wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'update_complete') {
            const { step, loss, accuracy, lr } = data;
            
            // Append point to sparkline, keep max 30 points
            const history = get().accuracyHistory;
            const updatedHistory = [...history, { step, accuracy }].slice(-30);

            set({
              step,
              learningRate: lr,
              accuracyHistory: updatedHistory,
            });

            // Trigger refetches for charts and visualizers
            get().fetchForgettingMonitor();
            get().fetchReplayBuffer();
            get().fetchStatus();

            useNotificationsStore.getState().addLog(
              `🧠 Online learning step ${step} complete: loss ${loss.toFixed(4)}, accuracy ${(accuracy * 100).toFixed(1)}%`,
              'success'
            );
          }
        } catch (err) {
          // ignore parsing error
        }
      };

      wsConnection.onerror = () => {
        set({ isRunning: false });
      };

      wsConnection.onclose = () => {
        wsConnection = null;
        set({ isRunning: false });
      };
    },

    disconnectLearningEvents: () => {
      if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
      }
      set({ isRunning: false });
    }
  }))
);
