import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ForgettingMonitor } from '../components/online/ForgettingMonitor';
import { LearningRateSlider } from '../components/online/LearningRateSlider';
import { useOnlineLearningStore } from '../store/onlineLearning';
import { getStableColor } from '../lib/colorByHash';

// Mock Recharts for reliable testing of line attributes in jsdom
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
    Line: ({ stroke, name, dataKey }: any) => (
      <div data-testid="chart-line" data-stroke={stroke} data-name={name} data-key={dataKey} />
    ),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

// Mock useOnlineConfig hook
const mockUpdateConfig = vi.fn();
vi.mock('../hooks/useOnlineConfig', () => ({
  useOnlineConfig: () => ({
    updateConfig: mockUpdateConfig,
    isPending: false,
  }),
}));

describe('Stable Color Hashing Utility', () => {
  it('should return stable and consistent HSL colors for the same task label', () => {
    const color1 = getStableColor('task_A');
    const color2 = getStableColor('task_A');
    const colorB = getStableColor('task_B');

    expect(color1).toBe(color2);
    expect(color1).not.toBe(colorB);
    expect(color1).toContain('hsl(');
  });
});

describe('ForgettingMonitor', () => {
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

  it('renders stable line colors when new tasks are added', () => {
    // 1. Set initial accuracy history containing tasks A and B
    useOnlineLearningStore.setState({
      accuracyHistory: [
        {
          step: 1,
          overall: 0.9,
          perTask: { task_A: 0.95, task_B: 0.85 },
        },
      ],
    });

    const { rerender } = render(<ForgettingMonitor />);

    // 2. Locate line for task_A and verify color
    let lines = screen.getAllByTestId('chart-line');
    const lineA = lines.find((l) => l.getAttribute('data-key') === 'task_A');
    expect(lineA).toBeDefined();
    const colorABefore = lineA?.getAttribute('data-stroke');
    expect(colorABefore).toBe(getStableColor('task_A'));

    // 3. Add task_C to accuracy history
    act(() => {
      useOnlineLearningStore.setState({
        accuracyHistory: [
          {
            step: 1,
            overall: 0.9,
            perTask: { task_A: 0.95, task_B: 0.85 },
          },
          {
            step: 2,
            overall: 0.88,
            perTask: { task_A: 0.94, task_B: 0.82, task_C: 0.78 },
          },
        ],
      });
    });

    // 4. Rerender and assert that task_A's line color has not changed
    rerender(<ForgettingMonitor />);

    lines = screen.getAllByTestId('chart-line');
    const lineAAfter = lines.find((l) => l.getAttribute('data-key') === 'task_A');
    expect(lineAAfter).toBeDefined();
    expect(lineAAfter?.getAttribute('data-stroke')).toBe(colorABefore);
  });
});

describe('LearningRateSlider', () => {
  beforeEach(() => {
    useOnlineLearningStore.setState({
      wsState: 'idle',
      learnerState: {
        status: 'idle',
        total_steps: 0,
        current_lr: 1e-4,
        replay_buffer_size: 0,
        checkpoint_count: 0,
        last_checkpoint_step: null,
        ewc_lambda: 400.0,
      },
      events: [],
      forgettingAlerts: [],
      lrHistory: [],
      accuracyHistory: [],
      replayBufferSnapshot: null,
    });
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces rapid change events correctly and calls updateConfig once after 800ms', () => {
    render(<LearningRateSlider />);

    const slider = screen.getByRole('slider');

    // Simulate 10 rapid change events on the slider
    for (let i = 1; i <= 10; i++) {
      const targetVal = 1e-4 + i * 1e-5;
      act(() => {
        fireEvent.change(slider, { target: { value: targetVal.toString() } });
      });
    }

    // Assert updateConfig has not been called immediately
    expect(mockUpdateConfig).not.toHaveBeenCalled();

    // Advance timer by 799ms - should still not be called
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(mockUpdateConfig).not.toHaveBeenCalled();

    // Advance timer past the 800ms debounce window
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Assert updateConfig is called exactly once with the final slider value (2.0e-4)
    expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
    expect(mockUpdateConfig).toHaveBeenCalledWith({ learning_rate: 2e-4 });
  });
});
