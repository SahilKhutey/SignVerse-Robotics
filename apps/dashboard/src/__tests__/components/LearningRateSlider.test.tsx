import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LearningRateSlider } from '../../components/online/LearningRateSlider';
import { useOnlineLearningStore } from '../../store/onlineLearning';

const mockUpdateConfig = vi.fn();
vi.mock('../../hooks/useOnlineConfig', () => ({
  useOnlineConfig: () => ({
    updateConfig: mockUpdateConfig,
    isPending: false,
  }),
}));

describe('components/LearningRateSlider.test.tsx', () => {
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

  it('debounce_fires_once_after_burst', () => {
    render(<LearningRateSlider />);
    const slider = screen.getByRole('slider');

    for (let i = 1; i <= 10; i++) {
      const val = 1e-4 + i * 1e-5;
      act(() => {
        fireEvent.change(slider, { target: { value: val.toString() } });
      });
    }

    expect(mockUpdateConfig).not.toHaveBeenCalled();

    // Advance 800ms
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
    expect(mockUpdateConfig).toHaveBeenCalledWith({ learning_rate: 2e-4 });
  });

  it('danger_zone_class_applied_above_2e4', () => {
    // 1. Initial render with 1e-4
    const { rerender } = render(<LearningRateSlider />);
    let slider = screen.getByRole('slider');
    expect(slider.className).not.toContain('danger-zone');

    // 2. Set slider value to 2.5e-4
    act(() => {
      fireEvent.change(slider, { target: { value: '0.00025' } });
    });
    expect(slider.className).toContain('danger-zone');

    // 3. Set slider value to 1e-4
    act(() => {
      fireEvent.change(slider, { target: { value: '0.0001' } });
    });
    expect(slider.className).not.toContain('danger-zone');
  });

  it('displays_scientific_notation', () => {
    render(<LearningRateSlider />);
    
    // Value is 1e-4
    expect(screen.getByText('1.0e-4')).toBeDefined();

    // Set to 0.00025 -> should display 2.5e-4
    const slider = screen.getByRole('slider');
    act(() => {
      fireEvent.change(slider, { target: { value: '0.00025' } });
    });
    expect(screen.getByText('2.5e-4')).toBeDefined();
  });
});
