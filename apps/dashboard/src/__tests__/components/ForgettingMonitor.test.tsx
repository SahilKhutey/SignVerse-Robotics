import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ForgettingMonitor } from '../../components/online/ForgettingMonitor';
import { useOnlineLearningStore } from '../../store/onlineLearning';
import { getStableColor } from '../../lib/colorByHash';

const mockUpdateConfig = vi.fn();
vi.mock('../../hooks/useOnlineConfig', () => ({
  useOnlineConfig: () => ({
    updateConfig: mockUpdateConfig,
    isPending: false,
  }),
}));

describe('components/ForgettingMonitor.test.tsx', () => {
  beforeEach(() => {
    useOnlineLearningStore.setState({
      wsState: 'idle',
      learnerState: null,
      events: [],
      forgettingAlerts: [],
      lrHistory: [],
      accuracyHistory: [],
      replayBufferSnapshot: null,
    });
    vi.clearAllMocks();
  });

  it('renders_one_line_per_task', () => {
    useOnlineLearningStore.setState({
      accuracyHistory: [
        {
          step: 1,
          overall: 0.85,
          perTask: {
            task_a: 0.8,
            task_b: 0.9,
            task_c: 0.85,
          },
        },
      ],
    });

    render(<ForgettingMonitor />);

    const lines = screen.getAllByTestId('chart-line');
    // Lines rendered: overall + task_a + task_b + task_c = 4 lines total,
    // but the task lines are: task_a, task_b, task_c
    const taskLines = lines.filter(
      (l) => l.getAttribute('data-key') !== 'overall'
    );
    expect(taskLines.length).toBe(3);
    expect(taskLines.map((l) => l.getAttribute('data-key'))).toContain('task_a');
    expect(taskLines.map((l) => l.getAttribute('data-key'))).toContain('task_b');
    expect(taskLines.map((l) => l.getAttribute('data-key'))).toContain('task_c');
  });

  it('stable_color_on_new_task_insertion', () => {
    // 1. Initial render with [task_a, task_b]
    useOnlineLearningStore.setState({
      accuracyHistory: [
        {
          step: 1,
          overall: 0.85,
          perTask: {
            task_a: 0.8,
            task_b: 0.9,
          },
        },
      ],
    });

    const { rerender } = render(<ForgettingMonitor />);
    
    let lines = screen.getAllByTestId('chart-line');
    const lineA = lines.find((l) => l.getAttribute('data-key') === 'task_a');
    const lineB = lines.find((l) => l.getAttribute('data-key') === 'task_b');
    
    expect(lineA).toBeDefined();
    expect(lineB).toBeDefined();
    
    const colorA = lineA?.getAttribute('data-stroke');
    const colorB = lineB?.getAttribute('data-stroke');

    expect(colorA).toBe(getStableColor('task_a'));
    expect(colorB).toBe(getStableColor('task_b'));

    // 2. Re-render with [task_c, task_a, task_b]
    act(() => {
      useOnlineLearningStore.setState({
        accuracyHistory: [
          {
            step: 1,
            overall: 0.85,
            perTask: {
              task_a: 0.8,
              task_b: 0.9,
            },
          },
          {
            step: 2,
            overall: 0.84,
            perTask: {
              task_c: 0.75,
              task_a: 0.79,
              task_b: 0.89,
            },
          },
        ],
      });
    });

    rerender(<ForgettingMonitor />);

    lines = screen.getAllByTestId('chart-line');
    const lineAAfter = lines.find((l) => l.getAttribute('data-key') === 'task_a');
    const lineBAfter = lines.find((l) => l.getAttribute('data-key') === 'task_b');

    expect(lineAAfter?.getAttribute('data-stroke')).toBe(colorA);
    expect(lineBAfter?.getAttribute('data-stroke')).toBe(colorB);
  });

  it('alert_badges_sorted_newest_first', () => {
    useOnlineLearningStore.setState({
      forgettingAlerts: [
        { task_label: 'task_a', accuracy_before: 0.9, accuracy_after: 0.8, drop_percent: 10, step: 10 },
        { task_label: 'task_b', accuracy_before: 0.95, accuracy_after: 0.9, drop_percent: 5, step: 5 },
        { task_label: 'task_c', accuracy_before: 0.8, accuracy_after: 0.6, drop_percent: 20, step: 20 },
      ],
    });

    render(<ForgettingMonitor />);

    // In ForgettingMonitor, the text for each alert is inside a flex wrapper.
    // e.g. "task_c: dropped 20% at step 20"
    // Let's assert the text content order.
    // In ForgettingMonitor.tsx, the displayedAlerts are mapped inside the alerts list:
    // displayedAlerts = sortedAlerts.slice(0, 10);
    // where sortedAlerts is sorted step descending.
    const textEls = screen.queryAllByText(/dropped/i);
    expect(textEls.length).toBe(3);
    expect(textEls[0].textContent).toContain('step 20');
    expect(textEls[1].textContent).toContain('step 10');
    expect(textEls[2].textContent).toContain('step 5');
  });

  it('lr_suggestion_shows_after_3_consecutive_alerts', () => {
    const { rerender } = render(<ForgettingMonitor />);
    expect(screen.queryByText(/Persistent Forgetting Detected/i)).toBeNull();

    // Push 3 alerts with same label consecutively
    act(() => {
      useOnlineLearningStore.setState({
        forgettingAlerts: [
          { task_label: 'reach_left', accuracy_before: 0.9, accuracy_after: 0.8, drop_percent: 10, step: 5 },
          { task_label: 'reach_left', accuracy_before: 0.8, accuracy_after: 0.7, drop_percent: 12.5, step: 10 },
          { task_label: 'reach_left', accuracy_before: 0.7, accuracy_after: 0.6, drop_percent: 14.3, step: 15 },
        ],
      });
    });

    rerender(<ForgettingMonitor />);
    expect(screen.getByText(/Persistent Forgetting Detected/i)).toBeDefined();
    expect(screen.getByText(/Reduce LR by 50%/i)).toBeDefined();
  });
});
