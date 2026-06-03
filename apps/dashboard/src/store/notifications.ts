import { create } from 'zustand';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
}

interface NotificationsState {
  logs: LogEntry[];
  addLog: (message: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  logs: [
    {
      id: 'init',
      timestamp: new Date().toLocaleTimeString(),
      message: 'Robotics Console Online. Awaiting connection to gateway.',
      type: 'info',
    },
  ],

  addLog: (message, type = 'info') =>
    set((state) => ({
      logs: [
        {
          id: Math.random().toString(),
          timestamp: new Date().toLocaleTimeString(),
          message,
          type,
        },
        ...state.logs,
      ].slice(0, 100),
    })),

  clearLogs: () => set({ logs: [] }),
}));
