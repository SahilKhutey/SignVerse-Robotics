import { create } from 'zustand';
import { VITE_API_URL } from '../lib/env';
import { useNotificationsStore } from './notifications';

export interface FatigueSignals {
  ear: number;
  head_pitch: number;
  hand_velocity: number;
}

interface FatigueState {
  fatigueScore: number;
  state: 'ok' | 'caution' | 'fatigued';
  signals: FatigueSignals;
  calibrating: boolean;
  
  // Timer state for the 5-minute break
  breakTimerActive: boolean;
  breakTimeRemaining: number; // in seconds
  
  // Web socket reference
  socket: WebSocket | null;
  
  // Actions
  connectFatigueStream: () => void;
  disconnectFatigueStream: () => void;
  startBreakTimer: () => void;
  stopBreakTimer: () => void;
  decrementBreakTimer: () => void;
  resetBreakTimer: () => void;
  resumeRecordingSession: () => Promise<void>;
  pauseRecordingSession: () => Promise<void>;
}

export const useFatigueStore = create<FatigueState>((set, get) => {
  let timerInterval: any = null;

  return {
    fatigueScore: 0.0,
    state: 'ok',
    signals: { ear: 0.3, head_pitch: 0.0, hand_velocity: 0.0 },
    calibrating: true,
    
    breakTimerActive: false,
    breakTimeRemaining: 300, // 5 minutes
    
    socket: null,
    
    connectFatigueStream: () => {
      if (get().socket) return;
      
      const defaultWsUrl = 'ws://localhost:3000';
      const envWsUrl = import.meta.env.VITE_WS_URL || (import.meta.env.VITE_API_URL 
        ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws') 
        : defaultWsUrl);
        
      const wsUrl = `${envWsUrl.replace(/^http/, 'ws')}/ws/fatigue_events`;
      
      try {
        const ws = new WebSocket(wsUrl);
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'fatigue_update') {
              set({
                fatigueScore: data.fatigue_score,
                state: data.state,
                signals: data.signals,
                calibrating: data.calibrating
              });
            } else if (data.type === 'PAUSE_RECORDING') {
              // Pause the recording in telemetry store
              import('./telemetry').then(({ useTelemetryStore }) => {
                const telemetryState = useTelemetryStore.getState();
                if (telemetryState.isRecording) {
                  useTelemetryStore.setState({ isRecording: false });
                  useNotificationsStore.getState().addLog(
                    '⚠️ FATIGUE DETECTED: Teleoperation recording paused automatically. Please take a break.', 
                    'error'
                  );
                }
              });
              // Activate break timer
              get().startBreakTimer();
            }
          } catch (e) {
            // ignore JSON parse failures
          }
        };
        
        ws.onclose = () => {
          set({ socket: null });
        };
        
        set({ socket: ws });
      } catch (err) {
        console.error('Failed to connect to fatigue events socket:', err);
      }
    },
    
    disconnectFatigueStream: () => {
      const { socket } = get();
      if (socket) {
        socket.close();
        set({ socket: null });
      }
    },
    
    startBreakTimer: () => {
      if (timerInterval) clearInterval(timerInterval);
      set({ breakTimerActive: true, breakTimeRemaining: 300 });
      
      timerInterval = setInterval(() => {
        const remaining = get().breakTimeRemaining;
        if (remaining <= 1) {
          get().stopBreakTimer();
        } else {
          set({ breakTimeRemaining: remaining - 1 });
        }
      }, 1000);
    },
    
    stopBreakTimer: () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      set({ breakTimerActive: false });
    },
    
    decrementBreakTimer: () => {
      const remaining = get().breakTimeRemaining;
      if (remaining > 0) {
        set({ breakTimeRemaining: remaining - 1 });
      }
    },
    
    resetBreakTimer: () => {
      get().stopBreakTimer();
      set({ breakTimeRemaining: 300 });
    },
    
    resumeRecordingSession: async () => {
      try {
        const response = await fetch(`${VITE_API_URL}/api/record/resume`, {
          method: 'POST',
          headers: { 'X-API-Key': 'signverse_local_dev_key' }
        });
        if (response.ok) {
          // Restart recording state in telemetry store
          import('./telemetry').then(({ useTelemetryStore }) => {
            useTelemetryStore.setState({ isRecording: true });
          });
          get().resetBreakTimer();
          set({ state: 'ok', fatigueScore: 0.0 });
        }
      } catch (e) {
        console.error('Failed to resume recording session:', e);
      }
    },
    
    pauseRecordingSession: async () => {
      try {
        await fetch(`${VITE_API_URL}/api/record/pause`, {
          method: 'POST',
          headers: { 'X-API-Key': 'signverse_local_dev_key' }
        });
      } catch (e) {
        console.error('Failed to pause recording session:', e);
      }
    }
  };
});
