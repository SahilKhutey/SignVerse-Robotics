import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOnlineLearningStore } from '../../store/onlineLearning';

describe('hooks/useLearningEvents.test.ts', () => {
  let wsConstructorSpy: any;
  let wsInstances: any[] = [];
  const mockClose = vi.fn();
  const mockSend = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    useOnlineLearningStore.setState({
      wsState: "idle",
      events: [],
      forgettingAlerts: [],
      accuracyHistory: [],
      lrHistory: [],
    });

    wsInstances = [];
    mockClose.mockClear();
    mockSend.mockClear();

    wsConstructorSpy = vi.fn().mockImplementation(function (this: any, url: string) {
      this.url = url;
      this.readyState = 0; // CONNECTING
      this.close = mockClose;
      this.send = mockSend;
      wsInstances.push(this);
    });
    globalThis.WebSocket = wsConstructorSpy as any;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('singleton_ws_one_connection_per_app', async () => {
    const { useLearningEvents } = await import('../../hooks/useLearningEvents');

    // Mount 3 hooks concurrently
    const h1 = renderHook(() => useLearningEvents());
    const h2 = renderHook(() => useLearningEvents());
    const h3 = renderHook(() => useLearningEvents());

    // Assert that the WebSocket constructor was called exactly once
    expect(wsConstructorSpy).toHaveBeenCalledTimes(1);

    h1.unmount();
    h2.unmount();
    h3.unmount();
  });

  it('reconnects_on_close_with_backoff', async () => {
    const { useLearningEvents } = await import('../../hooks/useLearningEvents');

    const { unmount } = renderHook(() => useLearningEvents());
    
    expect(wsConstructorSpy).toHaveBeenCalledTimes(1);
    const ws1 = wsInstances[0];
    
    // Simulate close 1
    ws1.onclose();
    expect(wsConstructorSpy).toHaveBeenCalledTimes(1); // Not reconnected yet

    // Advance 1s (backoff starts at 1000ms)
    vi.advanceTimersByTime(1000);
    expect(wsConstructorSpy).toHaveBeenCalledTimes(2);
    const ws2 = wsInstances[1];

    // Simulate close 2
    ws2.onclose();
    // Advance 2s (backoff = 2000ms)
    vi.advanceTimersByTime(2000);
    expect(wsConstructorSpy).toHaveBeenCalledTimes(3);
    const ws3 = wsInstances[2];

    // Simulate close 3
    ws3.onclose();
    // Advance 4s (backoff caps at 4000ms)
    vi.advanceTimersByTime(4000);
    expect(wsConstructorSpy).toHaveBeenCalledTimes(4);

    unmount();
  });

  it('unknown_message_type_does_not_throw', async () => {
    const { useLearningEvents } = await import('../../hooks/useLearningEvents');

    const { unmount } = renderHook(() => useLearningEvents());
    const ws = wsInstances[0];

    // Mock warning console
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Send unknown message
    expect(() => {
      ws.onmessage({ data: JSON.stringify({ type: "totally_unknown" }) });
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    unmount();
  });

  it('unmount_closes_ws', async () => {
    const { useLearningEvents } = await import('../../hooks/useLearningEvents');

    const { unmount } = renderHook(() => useLearningEvents());
    expect(mockClose).not.toHaveBeenCalled();

    unmount();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
