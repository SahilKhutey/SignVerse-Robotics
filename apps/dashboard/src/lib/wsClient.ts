import { WSMessage } from '@signverse/shared-types';
import { usePerformanceStore } from '../store/performance';
import * as Sentry from '@sentry/react';

export type WSState = 'IDLE' | 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'DEAD';

type MessageCallback = (msg: WSMessage) => void;
type StateCallback = (state: WSState) => void;

class WSClient {
  private socket: WebSocket | null = null;
  private url: string;
  private state: WSState = 'IDLE';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 6; // 1s, 2s, 4s, 8s, 16s, 30s limits
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  private messageListeners = new Set<MessageCallback>();
  private stateListeners = new Set<StateCallback>();

  constructor() {
    const defaultWsUrl = 'ws://localhost:3000';
    const envWsUrl = import.meta.env.VITE_WS_URL || (import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws') 
      : defaultWsUrl);
    this.url = `${envWsUrl}/ws/telemetry`;

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (this.state === 'RECONNECTING' || this.state === 'DEAD') {
        console.log('[WS] Tab focus detected. Forcing immediate reconnect.');
        this.reconnectAttempts = 0;
        this.connect();
      }
    }
  };

  public connect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        return;
      }
      this.socket.close();
    }

    const isRetry = this.reconnectAttempts > 0;
    this.setState(isRetry ? 'RECONNECTING' : 'CONNECTING');

    const connectStartTime = performance.now();

    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setState('LIVE');
        const connectEndTime = performance.now();
        const duration = Math.round(connectEndTime - connectStartTime);
        usePerformanceStore.getState().updateMetric('wsConnectMs', duration);
      };

      this.socket.onmessage = (event) => {
        try {
          const rawData = JSON.parse(event.data);
          let mappedMessage: WSMessage | null = null;

          if (rawData.type === 'telemetry') {
            const j = rawData.joints || { J0: 0, J1: 0, J2: 0 };
            mappedMessage = {
              type: 'telemetry',
              data: {
                jointAngles: [j.J0, j.J1, j.J2, 0, 0, 0, 0],
                poseLandmarks: [],
                aiPrediction: [0, 0, 0, 0, 0, 0, 0],
                confidence: 0.95,
                timestampMs: Date.now()
              }
            };
          } else if (rawData.type === 'SYSTEM_METRICS') {
            const payload = rawData.payload || {};
            const q = payload.q_target || [0, 0, 0];
            const rawLandmarks = (payload.pose_landmarks || []).map((pt: any) => ({
              x: pt.x || 0,
              y: pt.y || 0,
              z: pt.z || 0,
              visibility: pt.visibility || 1
            }));
            mappedMessage = {
              type: 'telemetry',
              data: {
                jointAngles: [q[0] * 57.2958, q[1] * 57.2958, q[2] * 57.2958, 0, 0, 0, 0],
                poseLandmarks: rawLandmarks,
                aiPrediction: [q[0] * 57.2958, q[1] * 57.2958, q[2] * 57.2958, 0, 0, 0, 0],
                confidence: 0.95,
                timestampMs: (payload.last_update || 0) * 1000
              }
            };
          } else if (rawData.type === 'PING' || rawData.type === 'ping') {
            this.send({ action: 'PONG', ts: rawData.ts || 0 });
          } else if (rawData.type === 'PONG' || rawData.type === 'pong') {
            mappedMessage = {
              type: 'pong',
              ts: rawData.ts || 0
            };
          } else if (rawData.type === 'RTT' || rawData.type === 'rtt') {
            mappedMessage = {
              type: 'rtt',
              rtt_ms: rawData.rtt_ms || 0
            };
          } else if (rawData.type === 'landmark') {
            mappedMessage = {
              type: 'landmark',
              data: { landmarks: rawData.landmarks || [] }
            };
          } else if (rawData.type === 'error') {
            mappedMessage = {
              type: 'error',
              message: rawData.message || 'Server Exception'
            };
          }

          if (mappedMessage) {
            this.notifyMessage(mappedMessage);
          }
        } catch (e) {
          // Parse failures are ignored
        }
      };

      this.socket.onclose = () => {
        this.socket = null;
        this.handleDisconnect();
      };

      this.socket.onerror = () => {
        // Socket close triggers the reconnect loop
      };
    } catch (err) {
      this.setState('DEAD');
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.setState('IDLE');
  }

  public send(data: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  public onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public onStateChange(callback: StateCallback): () => void {
    callback(this.state);
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  public getWSState(): WSState {
    return this.state;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getMaxReconnectAttempts(): number {
    return this.maxReconnectAttempts;
  }

  public getNextReconnectDelay(): number {
    return Math.min(Math.pow(2, this.reconnectAttempts || 1) * 1000, 30000);
  }

  private setState(state: WSState): void {
    this.state = state;
    this.stateListeners.forEach((callback) => callback(state));
  }

  private notifyMessage(msg: WSMessage): void {
    this.messageListeners.forEach((callback) => callback(msg));
  }

  private handleDisconnect(): void {
    if (this.state === 'IDLE') return;

    const sessionId = sessionStorage.getItem('signverse_session_id') || 'unknown';
    const userId = 'operator_local_dev';

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('DEAD');
      console.error('[WS] Connection dead. Max reconnect attempts reached.');
      Sentry.captureMessage('[WS] Connection dead. Max reconnect attempts reached.', {
        level: 'error',
        tags: { sessionId, userId, state: 'DEAD' }
      });
      return;
    }

    this.reconnectAttempts++;
    this.setState('RECONNECTING');

    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 30000);
    console.warn(`[WS] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    Sentry.captureMessage(`[WS] Connection lost. Reconnecting in ${delay}ms`, {
      level: 'warning',
      tags: { sessionId, userId, state: 'RECONNECTING', attempt: this.reconnectAttempts }
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export const wsClient = new WSClient();
