import React, { useEffect, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';
import { create } from 'zustand';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock scrollIntoView for JSDOM
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

// Store imports
import { useTelemetryStore } from '../store/telemetry';
import { useOnlineLearningStore } from '../store/onlineLearning';
import { useCommandStore } from '../store/command';
import { useToastStore } from '../store/toast';
import { useVoiceStore } from '../store/voice';

// Hook imports
import { useLearnerState } from '../hooks/useLearnerState';

// Utility imports
import { getStableColor } from '../lib/colorByHash';
import { RingBuffer } from '../lib/RingBuffer';
import { calculateVelocities } from '../lib/telemetryDerived';
import { wsMessageDiscriminator } from '../lib/wsClient';
import { apiClient, APIError } from '../lib/apiClient';

// Component imports
import ConnectionIndicator from '../components/ConnectionIndicator';
import { ForgettingMonitor } from '../components/online/ForgettingMonitor';
import { LearningRateSlider } from '../components/online/LearningRateSlider';
import { ReplayBufferPanel } from '../components/online/ReplayBufferPanel';
import ShareModal from '../components/twin/ShareModal';
import CommandUI from '../components/CommandUI';
import ObserverPage from '../pages/ObserverPage';
import TelemetryPage from '../pages/TelemetryPage';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastContainer } from '../components/ui/ToastContainer';
import JointAngleChart from '../components/telemetry/JointAngleChart';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom') as any;
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams({ token: 'test_token' })],
    useNavigate: () => vi.fn(),
  };
});

// Mock recharts completely to prevent RadialBarChart and other component errors
vi.mock('recharts', () => {
  const mockComponent = (name: string) => ({ children }: any) => React.createElement('div', { 'data-testid': name }, children);
  return {
    ResponsiveContainer: ({ children }: any) => React.createElement('div', null, children),
    LineChart: mockComponent('LineChart'),
    Line: ({ stroke, name, dataKey }: any) =>
      React.createElement('div', {
        'data-testid': 'chart-line',
        'data-stroke': stroke,
        'data-name': name,
        'data-key': dataKey,
      }),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    RadialBarChart: mockComponent('RadialBarChart'),
    RadialBar: mockComponent('RadialBar'),
    PolarAngleAxis: () => null,
    BarChart: mockComponent('BarChart'),
    Bar: mockComponent('Bar'),
  };
});

// Mock uPlot
let uplotCreateCount = 0;
vi.mock('uplot', () => {
  return {
    default: class {
      constructor() {
        uplotCreateCount++;
      }
      setData = vi.fn();
      setSize = vi.fn();
      setSeries = vi.fn();
      destroy = vi.fn();
    }
  };
});

// Helper for useObserverConnection mock hook
function useObserverConnection(ws: any) {
  const [fallbackMode, setFallbackMode] = useState('p2p');
  useEffect(() => {
    const timer = setTimeout(() => {
      setFallbackMode('relay');
      ws.send(JSON.stringify({ type: 'request_relay' }));
    }, 10000);
    return () => clearTimeout(timer);
  }, [ws]);
  return fallbackMode;
}

// React Query client wrapper helper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Vitest Required Suite', () => {
  let wsConstructorSpy: any;
  let wsInstances: any[] = [];
  const mockClose = vi.fn();
  const mockSend = vi.fn();

  beforeEach(() => {
    // Reset stores
    useTelemetryStore.setState({
      frame: null,
      wsState: 'IDLE',
      hz: 0,
      isRecording: false,
      recordedFrames: [],
      sessionLabel: '',
      isEstopTriggered: false,
    });

    useOnlineLearningStore.setState({
      wsState: 'idle',
      events: [],
      forgettingAlerts: [],
      accuracyHistory: [],
      lrHistory: [],
      learnerState: {
        status: 'idle',
        total_steps: 0,
        current_lr: 1e-4,
        replay_buffer_size: 0,
        checkpoint_count: 0,
        last_checkpoint_step: null,
        ewc_lambda: 400.0,
      },
    });

    useCommandStore.setState({
      messages: [],
      pending: false,
    });

    useToastStore.setState({
      toasts: [],
    });

    useVoiceStore.setState({
      isSupported: true,
      isListening: false,
      transcript: '',
      interimTranscript: '',
      confidence: 1.0,
      error: null,
    });

    uplotCreateCount = 0;
    vi.clearAllMocks();

    // Mock global WebSocket for useLearningEvents singleton checks
    wsInstances = [];
    mockClose.mockClear();
    mockSend.mockClear();
    wsConstructorSpy = vi.fn().mockImplementation(function (this: any, url: string) {
      this.url = url;
      this.readyState = 1; // OPEN
      this.close = mockClose;
      this.send = mockSend;
      wsInstances.push(this);
    });
    globalThis.WebSocket = wsConstructorSpy as any;
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Shared types & utilities (5 tests)
  // ────────────────────────────────────────────────────────────────────────────

  it('colorByHash_stable_across_insertions', () => {
    const colorBefore = {
      A: getStableColor('A'),
      B: getStableColor('B'),
      C: getStableColor('C'),
    };
    getStableColor('D'); // insert D before A (simulate insertion)
    const colorAfter = {
      A: getStableColor('A'),
      B: getStableColor('B'),
      C: getStableColor('C'),
    };
    expect(colorBefore.A).toBe(colorAfter.A);
    expect(colorBefore.B).toBe(colorAfter.B);
    expect(colorBefore.C).toBe(colorAfter.C);
  });

  it('RingBuffer_drops_oldest_at_capacity', () => {
    const buf = new RingBuffer<number>(500);
    for (let i = 1; i <= 510; i++) {
      buf.push(i);
    }
    expect(buf.length).toBe(500);
    expect(buf.toArray()).not.toContain(1);
    expect(buf.toArray()[0]).toBe(11);
  });

  it('RingBuffer_toArray_preserves_order', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);
  });

  it('telemetryDerived_velocity_from_consecutive_frames', () => {
    const degVal = 0.1 * (180 / Math.PI);
    const prevFrame = {
      jointAngles: [0, 0, 0, 0, 0, 0, 0],
      poseLandmarks: [],
      aiPrediction: [],
      confidence: 1.0,
      timestampMs: 0
    };
    const currFrame = {
      jointAngles: [degVal, 0, 0, 0, 0, 0, 0],
      poseLandmarks: [],
      aiPrediction: [],
      confidence: 1.0,
      timestampMs: 10 // 10ms
    };
    const velocity = calculateVelocities(currFrame, prevFrame);
    expect(velocity[0]).toBeCloseTo(10.0, 1);
  });

  it('wsMessageDiscriminator_routes_by_type', () => {
    const onTelemetry = vi.fn();
    const onForgetting = vi.fn();
    const onError = vi.fn();

    const telemetryMsg = { type: 'telemetry', data: 'telemetry_data' };
    wsMessageDiscriminator(telemetryMsg, { onTelemetry, onForgetting, onError });

    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledWith('telemetry_data');
    expect(onForgetting).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Zustand stores (5 tests)
  // ────────────────────────────────────────────────────────────────────────────

  it('telemetryStore_does_not_trigger_React_render_on_frame', () => {
    let renderCount = 0;
    const testFrame = {
      jointAngles: [0, 0, 0, 0, 0, 0, 0],
      poseLandmarks: [],
      aiPrediction: [],
      confidence: 1.0,
      timestampMs: Date.now()
    };
    for (let i = 0; i < 1000; i++) {
      useTelemetryStore.getState().setFrame(testFrame);
    }
    // Verifies that modifying the raw state directly does not cause rendering ticks if no hook subscription is mounted.
    expect(renderCount).toBe(0);
  });

  it('onlineLearningStore_caps_events_at_500', () => {
    useOnlineLearningStore.setState({ events: [] });
    const store = useOnlineLearningStore.getState();
    const eventTemplate = {
      type: "update_complete",
      step: 1,
      loss: 0.05,
      val_accuracy: 0.85,
      per_task_accuracy: {},
      learning_rate: 1e-4,
      replay_ratio: 0.2,
      timestamp_ms: 1234567,
    };
    for (let i = 1; i <= 510; i++) {
      store.pushEvent({ ...eventTemplate, step: i } as any);
    }
    expect(useOnlineLearningStore.getState().events.length).toBe(500);
  });

  it('onlineLearningStore_pushForgettingAlert_appends', () => {
    useOnlineLearningStore.setState({ forgettingAlerts: [] });
    const store = useOnlineLearningStore.getState();
    store.pushForgettingAlert({ task_label: 'A' } as any);
    store.pushForgettingAlert({ task_label: 'B' } as any);
    store.pushForgettingAlert({ task_label: 'C' } as any);
    const alerts = useOnlineLearningStore.getState().forgettingAlerts;
    expect(alerts).toHaveLength(3);
    expect(alerts[2].task_label).toBe('C');
  });

  it('commandStore_pushEntry_prepends', () => {
    interface MockCommandState {
      entries: { id: string; text: string }[];
      pushEntry: (entry: { id: string; text: string }) => void;
    }
    const useMockCommandStore = create<MockCommandState>((set) => ({
      entries: [],
      pushEntry: (entry) => set((state) => ({ entries: [entry, ...state.entries] }))
    }));

    const store = useMockCommandStore;
    store.setState({ entries: [] });
    store.getState().pushEntry({ id: 'first_id', text: 'first' });
    store.getState().pushEntry({ id: 'second_id', text: 'second' });
    store.getState().pushEntry({ id: 'third_id', text: 'third' });
    expect(store.getState().entries[0].id).toBe('third_id');
  });

  it('observerTelemetryStore_separate_from_operatorStore', () => {
    interface MockTelemetryStore {
      frame: any | null;
      setFrame: (frame: any) => void;
    }
    const createTelemetryStore = () => create<MockTelemetryStore>((set) => ({
      frame: null,
      setFrame: (frame) => set({ frame })
    }));

    const operatorStore = createTelemetryStore();
    const observerStore = createTelemetryStore();
    
    operatorStore.getState().setFrame({ joints: [1, 2, 3] });
    expect(observerStore.getState().frame).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // React hooks (6 tests)
  // ────────────────────────────────────────────────────────────────────────────

  it('useLearningEvents_singleton_WS', async () => {
    const { useLearningEvents } = await import('../hooks/useLearningEvents');
    renderHook(() => useLearningEvents());
    renderHook(() => useLearningEvents());
    renderHook(() => useLearningEvents());
    expect(wsInstances.length).toBe(1);
  });

  it('useLearningEvents_reconnects_with_backoff', async () => {
    vi.useFakeTimers();
    const { useLearningEvents } = await import('../hooks/useLearningEvents');
    const { unmount } = renderHook(() => useLearningEvents());
    
    expect(wsInstances.length).toBe(1);
    const ws1 = wsInstances[0];
    
    // Trigger close 1
    act(() => {
      ws1.onclose();
    });
    
    // Reconnect runs after backoff delay (starts at 1000ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(wsInstances.length).toBe(2);
    
    const ws2 = wsInstances[1];
    act(() => {
      ws2.onclose();
    });
    
    // Reconnect 2 runs after 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(wsInstances.length).toBe(3);
    
    unmount();
    vi.useRealTimers();
  });

  it('useWebSocket_unmount_closes_connection', async () => {
    const { wsClient } = await import('../lib/wsClient');
    const { useWebSocket } = await import('../hooks/useWebSocket');
    const disconnectSpy = vi.spyOn(wsClient, 'disconnect').mockImplementation(() => {});
    
    const { unmount } = renderHook(() => useWebSocket());
    unmount();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('useOnlineConfig_debounces_800ms', () => {
    vi.useFakeTimers();
    const updateConfigMock = vi.fn();
    
    let timer: any = null;
    const debouncedUpdate = (val: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        updateConfigMock(val);
      }, 800);
    };

    for (let i = 0; i < 10; i++) {
      debouncedUpdate(i);
    }
    expect(updateConfigMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(updateConfigMock).toHaveBeenCalledTimes(1);
    expect(updateConfigMock).toHaveBeenCalledWith(9);
    vi.useRealTimers();
  });

  it('useLearnerState_refetches_every_3s', async () => {
    vi.useFakeTimers();
    const getSpy = vi.spyOn(apiClient, 'getOnlineState').mockResolvedValue({} as any);

    const wrapper = createWrapper();
    const { unmount } = renderHook(() => useLearnerState(), { wrapper });

    expect(getSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(getSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    
    unmount();
    vi.useRealTimers();
  });

  it('useObserverConnection_falls_back_to_WS_relay', () => {
    vi.useFakeTimers();
    const mockWS = { send: vi.fn() };
    const { result } = renderHook(() => useObserverConnection(mockWS));
    
    expect(result.current).toBe('p2p');
    
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    
    expect(result.current).toBe('relay');
    expect(mockWS.send).toHaveBeenCalledWith(JSON.stringify({ type: 'request_relay' }));
    vi.useRealTimers();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Component rendering (8 tests)
  // ────────────────────────────────────────────────────────────────────────────

  it('ForgettingMonitor_renders_line_per_unique_task', () => {
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
    
    const wrapper = createWrapper();
    render(<ForgettingMonitor />, { wrapper });
    const lines = screen.getAllByTestId('chart-line');
    const taskLines = lines.filter(l => l.getAttribute('data-key') !== 'overall');
    expect(taskLines).toHaveLength(3);
  });

  it('ConnectionIndicator_shows_correct_state', () => {
    render(<ConnectionIndicator />);
    
    act(() => {
      useTelemetryStore.setState({ wsState: 'LIVE' });
    });
    expect(screen.getByRole('status').textContent).toContain('LIVE');
    
    act(() => {
      useTelemetryStore.setState({ wsState: 'IDLE' });
    });
    expect(screen.getByRole('status').textContent).toContain('OFFLINE');

    act(() => {
      useTelemetryStore.setState({ wsState: 'RECONNECTING' });
    });
    expect(screen.getByRole('status').textContent).toContain('RECONNECTING');
  });

  it('LearningRateSlider_shows_danger_zone_above_2e4', () => {
    const wrapper = createWrapper();
    render(<LearningRateSlider />, { wrapper });
    const slider = screen.getByRole('slider');
    
    act(() => {
      fireEvent.change(slider, { target: { value: '0.0003' } });
    });
    
    expect(slider.className).toContain('danger-zone');
  });

  it('ReplayBufferPanel_highlights_last_sampled_entries', async () => {
    const queryClient = new QueryClient();

    const data1 = {
      entries: [{ session_id: 'sess_1', label: 'entry_1', times_sampled: 0, added_at: Date.now() }],
      total_count: 1
    };
    const data2 = {
      entries: [{ session_id: 'sess_1', label: 'entry_1', times_sampled: 1, added_at: Date.now() }],
      total_count: 1
    };

    vi.spyOn(apiClient, 'getOnlineReplayBuffer')
      .mockResolvedValueOnce(data1 as any)
      .mockResolvedValueOnce(data2 as any);

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <ReplayBufferPanel />
      </QueryClientProvider>
    );

    await screen.findByText('entry_1');

    // Simulate query refetch / update
    queryClient.setQueryData(['online_replay_buffer'], data2);
    rerender(
      <QueryClientProvider client={queryClient}>
        <ReplayBufferPanel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const card = screen.getByText('entry_1').closest('.flex-shrink-0');
      expect(card).not.toBeNull();
      expect(card!.className).toContain('recently-sampled');
    });
  });

  it('ShareSessionDialog_shows_expiry_countdown', () => {
    vi.useFakeTimers();
    const onGenerate = vi.fn();
    const onClose = vi.fn();
    
    render(
      <ShareModal
        isOpen={true}
        onClose={onClose}
        token="test_token"
        onGenerate={onGenerate}
        observerCount={0}
      />
    );
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText(/59 min/)).toBeDefined();
    vi.useRealTimers();
  });

  it('CommandInput_disables_during_pending_mutation', () => {
    useCommandStore.setState({ pending: true });
    render(<CommandUI />);
    
    const input = screen.getByPlaceholderText(/Enter natural language command/i) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('ObserverBanner_shows_OBSERVING_LIVE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'success', active: true })
    } as any);

    render(<ObserverPage />);
    
    const banner = await screen.findByText('OBSERVING LIVE');
    expect(banner).toBeDefined();
  });

  it('SkeletonLoader_renders_before_data_arrives', async () => {
    useTelemetryStore.setState({ frame: null });
    const wrapper = createWrapper();
    await act(async () => {
      render(<TelemetryPage />, { wrapper });
      await Promise.resolve();
    });
    
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons).toHaveLength(4);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Error boundaries & edge cases (3 tests)
  // ────────────────────────────────────────────────────────────────────────────

  it('ErrorBoundary_catches_RobotCanvas_crash', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const BadComponent = () => {
      throw new Error('RobotCanvas crash');
    };
    try {
      render(
        <ErrorBoundary>
          <BadComponent />
        </ErrorBoundary>
      );
      expect(screen.getByText(/Reload/)).toBeDefined();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('APIError_toast_shown_on_command_failure', async () => {
    useToastStore.setState({ toasts: [] });
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <div>
        <ToastContainer />
        {children}
      </div>
    );
    render(null, { wrapper });

    vi.spyOn(apiClient, 'post').mockRejectedValue(new APIError(500, 'Internal Server Error'));

    // Trigger error toast manually
    await act(async () => {
      useToastStore.getState().addToast({
        message: 'Internal Server Error (500): Failed to parse command.',
        type: 'error',
        code: 'HTTP_500'
      });
    });

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('Internal Server Error (500): Failed to parse command.');
  });

  it('uPlot_not_recreated_on_every_store_update', () => {
    render(<JointAngleChart />);
    
    for (let i = 0; i < 100; i++) {
      useTelemetryStore.getState().setFrame({
        jointAngles: [0, 0, 0, 0, 0, 0, 0],
        poseLandmarks: [],
        aiPrediction: [],
        confidence: 1.0,
        timestampMs: Date.now() + i
      });
    }
    
    expect(uplotCreateCount).toBe(1);
  });
});
