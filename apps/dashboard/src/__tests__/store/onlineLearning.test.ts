import { describe, it, expect, beforeEach } from 'vitest';
import { useOnlineLearningStore } from '../../store/onlineLearning';
import { LearningEvent, ForgettingAlert } from '@signverse/shared-types';

describe('store/onlineLearning.test.ts', () => {
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

  it('ringBuffer_caps_at_500_events', () => {
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

    for (let i = 1; i <= 510; i++) {
      store.pushEvent({
        ...eventTemplate,
        step: i,
      });
    }

    const state = useOnlineLearningStore.getState();
    expect(state.events.length).toBe(500);
    // Oldest event at step 1 should be gone (first event in buffer is step 11)
    expect(state.events.find(e => e.step === 1)).toBeUndefined();
    expect(state.events[0].step).toBe(11);
    expect(state.events[499].step).toBe(510);
  });

  it('pushForgettingAlert_accumulates_correctly', () => {
    const store = useOnlineLearningStore.getState();
    const alerts: ForgettingAlert[] = [
      { task_label: "task_a", accuracy_before: 0.9, accuracy_after: 0.8, drop_percent: 10.0, step: 5 },
      { task_label: "task_b", accuracy_before: 0.95, accuracy_after: 0.75, drop_percent: 20.0, step: 10 },
      { task_label: "task_c", accuracy_before: 0.88, accuracy_after: 0.82, drop_percent: 6.8, step: 15 },
    ];

    alerts.forEach(store.pushForgettingAlert);

    const state = useOnlineLearningStore.getState();
    expect(state.forgettingAlerts.length).toBe(3);
    expect(state.forgettingAlerts[0].task_label).toBe("task_a");
    expect(state.forgettingAlerts[1].task_label).toBe("task_b");
    expect(state.forgettingAlerts[2].task_label).toBe("task_c");
  });

  it('resetAlerts_clears_only_alerts', () => {
    const store = useOnlineLearningStore.getState();
    
    // Add some event
    const event: LearningEvent = {
      type: "update_complete",
      step: 1,
      loss: 0.05,
      val_accuracy: 0.85,
      per_task_accuracy: {},
      learning_rate: 1e-4,
      replay_ratio: 0.2,
      timestamp_ms: 1234567,
    };
    store.pushEvent(event);

    // Add alert
    store.pushForgettingAlert({
      task_label: "task_a",
      accuracy_before: 0.9,
      accuracy_after: 0.8,
      drop_percent: 10.0,
      step: 5,
    });

    store.resetAlerts();

    const state = useOnlineLearningStore.getState();
    expect(state.forgettingAlerts.length).toBe(0);
    expect(state.events.length).toBe(1);
    expect(state.events[0]).toEqual(event);
  });

  it('accuracyHistory_ringBuffer_caps_at_1000', () => {
    const store = useOnlineLearningStore.getState();
    const eventTemplate: LearningEvent = {
      type: "update_complete",
      step: 1,
      loss: 0.05,
      val_accuracy: 0.85,
      per_task_accuracy: {},
      learning_rate: 1e-4,
      replay_ratio: 0.2,
      timestamp_ms: 1234567,
    };

    for (let i = 1; i <= 1100; i++) {
      store.updateAccuracyHistory({
        ...eventTemplate,
        step: i,
      });
    }

    const state = useOnlineLearningStore.getState();
    expect(state.accuracyHistory.length).toBe(1000);
    // Oldest step should be dropped
    expect(state.accuracyHistory.find(h => h.step === 1)).toBeUndefined();
    expect(state.accuracyHistory[0].step).toBe(101);
    expect(state.accuracyHistory[999].step).toBe(1100);
  });
});
