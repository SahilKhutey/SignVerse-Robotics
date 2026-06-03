import { useEffect, useRef } from 'react';
import { wsClient } from '../lib/wsClient';
import { useTelemetryStore, rawTelemetryRef } from '../store/telemetry';
import { useLandmarksStore } from '../store/landmarks';
import { useNotificationsStore } from '../store/notifications';
import { WSMessage } from '@signverse/shared-types';
import { telemetryRingBuffer } from '../lib/RingBuffer';

export function useWebSocket() {
  const estopSocketRef = useRef<WebSocket | null>(null);
  const activeRobotId = useTelemetryStore((state) => state.activeRobotId);
  const setEstop = useTelemetryStore((state) => state.setEstop);
  const setWsState = useTelemetryStore((state) => state.setWsState);
  const setHz = useTelemetryStore((state) => state.setHz);

  const triggerEstop = () => {
    const payload = {
      robotId: activeRobotId,
      triggeredBy: 'Operator Console UI',
      timestamp: Date.now()
    };

    setEstop(true);

    const defaultApiUrl = 'http://localhost:3000';
    const baseUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
    const estopWsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws/estop`;

    if (estopSocketRef.current && estopSocketRef.current.readyState === WebSocket.OPEN) {
      estopSocketRef.current.send(JSON.stringify(payload));
    } else {
      try {
        const estopWs = new WebSocket(estopWsUrl);
        estopWs.onopen = () => {
          estopWs.send(JSON.stringify(payload));
          estopSocketRef.current = estopWs;
        };
      } catch (err) {
        useNotificationsStore.getState().addLog('Emergency E-Stop channel failure!', 'error');
      }
    }
  };

  const clearEstopTrigger = () => {
    setEstop(false);
  };

  useEffect(() => {
    // 1. Establish connection to main raw telemetry stream
    wsClient.connect();

    // 2. Sync client connection states with telemetry store
    const unsubscribeState = wsClient.onStateChange((state) => {
      setWsState(state);
    });

    let frameCount = 0;

    // 3. Message dispatcher routing parsed unions
    const unsubscribeMessage = wsClient.onMessage((msg: WSMessage) => {
      if (msg.type === 'telemetry') {
        frameCount++;
        // Route raw 1000Hz frames to un-throttled ref
        rawTelemetryRef.current = msg.data;
        
        // Downsample 1000Hz telemetry to 200Hz for the uPlot circular history buffer
        if (frameCount % 5 === 0) {
          telemetryRingBuffer.push(msg.data);
        }
      } else if (msg.type === 'landmark') {
        // Route to landmarks store
        useLandmarksStore.getState().setLandmarks(msg.data);
      } else if (msg.type === 'error') {
        // Route server errors to notifications logs
        useNotificationsStore.getState().addLog(`⚠️ WS Server Error: ${msg.message}`, 'error');
      }
    });

    // 4. Throttle writes to 60Hz for standard React components
    const throttleInterval = setInterval(() => {
      if (rawTelemetryRef.current) {
        useTelemetryStore.getState().setFrame(rawTelemetryRef.current);
      }
    }, 1000 / 60);

    // 5. Run independent 1Hz frequency counter dispatch
    const hzInterval = setInterval(() => {
      setHz(frameCount);
      frameCount = 0;
    }, 1000);

    return () => {
      unsubscribeState();
      unsubscribeMessage();
      clearInterval(throttleInterval);
      clearInterval(hzInterval);
      if (estopSocketRef.current) {
        estopSocketRef.current.close();
      }
      wsClient.disconnect();
    };
  }, [setWsState, setHz, setEstop]);

  return { triggerEstop, clearEstopTrigger };
}
