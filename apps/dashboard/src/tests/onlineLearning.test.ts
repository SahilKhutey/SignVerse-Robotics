import { describe, it, expect, beforeEach } from 'vitest';
import { useOnlineLearningStore } from '../store/onlineLearning';
import { LearningEvent, ForgettingAlert } from '@signverse/shared-types';

describe('useOnlineLearningStore', () => {
  beforeEach(() => {
    useOnlineLearningStore.setState({
      wsState: "idle",
      learnerState: null,
      events: [],
      forgettingAlerts: [],
      lrHistory: [],
      accuracyHistory: [],
      replayBufferSnapshot: null,
    });
  });

  it('should update wsState and learnerState', () => {
    const store = useOnlineLearningStore.getState();
    store.setWsState('live');
    expect(useOnlineLearningStore.getState().wsState).toBe('live');

    const testState = {
      status: "updating" as const,
      total_steps: 120,
      current_lr: 1e-4,
      replay_buffer_size: 45,
      checkpoint_count: 3,
      last_checkpoint_step: 100,
      ewc_lambda: 400.0,
    };
    store.setLearnerState(testState);
    expect(useOnlineLearningStore.getState().learnerState).toEqual(testState);
  });

  it('should ring-buffer events at max 500 entries', () => {
    const store = useOnlineLearningStore.getState();
    const eventTemplate: LearningEvent = {
      type: "update_complete",
      step: 1,
      loss: 0.05,
      val_accuracy: 0.85,
      per_task_accuracy: { "task_a": 0.85 },
      learning_rate: 1e-4,
      replay_ratio: 0.2,
      timestamp_ms: 1234567,
    };

    // Push 510 events
    for (let i = 1; i <= 510; i++) {
      store.pushEvent({
        ...eventTemplate,
        step: i,
      });
    }

    const state = useOnlineLearningStore.getState();
    expect(state.events.length).toBe(500);
    expect(state.events[0].step).toBe(11);
    expect(state.events[499].step).toBe(510);
  });

  it('should push forgetting alert and reset alerts', () => {
    const store = useOnlineLearningStore.getState();
    const alert: ForgettingAlert = {
      task_label: "task_a",
      accuracy_before: 0.9,
      accuracy_after: 0.8,
      drop_percent: 10.0,
      step: 15,
    };

    store.pushForgettingAlert(alert);
    expect(useOnlineLearningStore.getState().forgettingAlerts).toEqual([alert]);

    store.resetAlerts();
    expect(useOnlineLearningStore.getState().forgettingAlerts).toEqual([]);
  });

  it('should ring-buffer accuracyHistory at max 1000 entries', () => {
    const store = useOnlineLearningStore.getState();
    const eventTemplate: LearningEvent = {
      type: "update_complete",
      step: 1,
      loss: 0.05,
      val_accuracy: 0.85,
      per_task_accuracy: { "task_a": 0.85 },
      learning_rate: 1e-4,
      replay_ratio: 0.2,
      timestamp_ms: 1234567,
    };

    // Push 1005 updates
    for (let i = 1; i <= 1005; i++) {
      store.updateAccuracyHistory({
        ...eventTemplate,
        step: i,
        val_accuracy: i / 1000,
      });
    }

    const state = useOnlineLearningStore.getState();
    expect(state.accuracyHistory.length).toBe(1000);
    expect(state.accuracyHistory[0].step).toBe(6);
    expect(state.accuracyHistory[999].step).toBe(1005);
  });

  it('should ring-buffer lrHistory at max 1000 entries', () => {
    const store = useOnlineLearningStore.getState();
    const eventTemplate: LearningEvent = {
      type: "lr_adjusted",
      step: 1,
      loss: 0.0,
      val_accuracy: 0.85,
      per_task_accuracy: { "task_a": 0.85 },
      learning_rate: 1e-4,
      replay_ratio: 0.2,
      timestamp_ms: 1234567,
    };

    // Push 1005 adjustments
    for (let i = 1; i <= 1005; i++) {
      store.updateLrHistory({
        ...eventTemplate,
        step: i,
        learning_rate: 1e-4 - i * 1e-8,
      });
    }

    const state = useOnlineLearningStore.getState();
    expect(state.lrHistory.length).toBe(1000);
    expect(state.lrHistory[0].step).toBe(6);
    expect(state.lrHistory[999].step).toBe(1005);
  });
});
