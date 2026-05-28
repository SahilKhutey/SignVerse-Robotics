import { create } from 'zustand';

let ws = null;
let reconnectTimer = null;

export const useTelemetryStore = create((set, get) => ({
  telemetry: null,
  logs: [],
  isConnected: false,
  apiError: null,

  connect: (url) => {
    if (ws) return;
    
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      set({ isConnected: true, apiError: null });
      get().addLog('SYSTEM', 'WebSocket Telemetry Connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Route events based on TYPE
        switch (data.type) {
          case 'SYSTEM_METRICS':
            set({ telemetry: data.payload });
            break;
          case 'POSE_FRAME':
            // Will be passed to pipelineStore or 3D Stage later
            break;
          case 'PIPELINE_STATUS':
            // Handle job statuses
            break;
          default:
            // Legacy fallback
            if (!data.type) set({ telemetry: data });
        }
      } catch (err) {
        console.error('Telemetry Parse Error:', err);
      }
    };
    
    ws.onclose = () => {
      set({ isConnected: false });
      ws = null;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          get().connect(url);
        }, 3000);
      }
    };

    ws.onerror = (err) => {
      set({ apiError: 'WebSocket Connection Failed' });
    };
  },

  disconnect: () => {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  },

  addLog: (source, message) => {
    const newLog = {
      id: Date.now() + Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      source,
      message,
    };
    set((state) => ({ logs: [newLog, ...state.logs].slice(0, 50) })); // Keep last 50 logs
  },

  setApiError: (err) => set({ apiError: err })
}));
