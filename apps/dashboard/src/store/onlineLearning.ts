import { create } from 'zustand';
import { produce } from 'immer';
import { LearningEvent, OnlineLearnerState, ForgettingAlert, ReplayBufferEntry } from '@signverse/shared-types';

export interface OnlineLearningStore {
  wsState: "idle" | "connecting" | "live" | "error";
  learnerState: OnlineLearnerState | null;
  events: LearningEvent[];
  forgettingAlerts: ForgettingAlert[];
  lrHistory: { step: number; lr: number }[];
  accuracyHistory: { step: number; overall: number; perTask: Record<string, number> }[];
  replayBufferSnapshot: ReplayBufferEntry[] | null;

  // Actions
  setWsState: (state: "idle" | "connecting" | "live" | "error") => void;
  setLearnerState: (s: OnlineLearnerState | null) => void;
  pushEvent: (e: LearningEvent) => void;
  pushForgettingAlert: (a: ForgettingAlert) => void;
  updateAccuracyHistory: (e: LearningEvent) => void;
  updateLrHistory: (e: LearningEvent) => void;
  setReplaySnapshot: (entries: ReplayBufferEntry[] | null) => void;
  resetAlerts: () => void;
}

export const useOnlineLearningStore = create<OnlineLearningStore>((set) => ({
  wsState: "idle",
  learnerState: null,
  events: [],
  forgettingAlerts: [],
  lrHistory: [],
  accuracyHistory: [],
  replayBufferSnapshot: null,

  setWsState: (wsState) => set({ wsState }),

  setLearnerState: (learnerState) => set({ learnerState }),

  pushEvent: (e) => set(
    produce((state: OnlineLearningStore) => {
      state.events.push(e);
      if (state.events.length > 500) {
        state.events.shift();
      }
    })
  ),

  pushForgettingAlert: (a) => set(
    produce((state: OnlineLearningStore) => {
      state.forgettingAlerts.push(a);
    })
  ),

  updateAccuracyHistory: (e) => set(
    produce((state: OnlineLearningStore) => {
      state.accuracyHistory.push({
        step: e.step,
        overall: e.val_accuracy,
        perTask: e.per_task_accuracy,
      });
      if (state.accuracyHistory.length > 1000) {
        state.accuracyHistory.shift();
      }
    })
  ),

  updateLrHistory: (e) => set(
    produce((state: OnlineLearningStore) => {
      state.lrHistory.push({
        step: e.step,
        lr: e.learning_rate,
      });
      if (state.lrHistory.length > 1000) {
        state.lrHistory.shift();
      }
    })
  ),

  setReplaySnapshot: (entries) => set({ replayBufferSnapshot: entries }),

  resetAlerts: () => set({ forgettingAlerts: [] }),
}));

if (typeof window !== 'undefined') {
  (window as any).useOnlineLearningStore = useOnlineLearningStore;
}
