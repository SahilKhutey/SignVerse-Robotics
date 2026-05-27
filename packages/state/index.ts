import { create } from 'zustand';

interface PanelState {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isOpen: boolean;
}

interface LayoutStore {
  panels: PanelState[];
  togglePanel: (id: string) => void;
  updatePanelPosition: (id: string, x: number, y: number) => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  panels: [
    { id: 'viewport', title: '3D Simulation', x: 0, y: 0, w: 2, h: 2, isOpen: true },
    { id: 'telemetry', title: 'Live Telemetry', x: 2, y: 0, w: 1, h: 1, isOpen: true },
    { id: 'terminal', title: 'AI Logs', x: 2, y: 1, w: 1, h: 1, isOpen: true }
  ],
  togglePanel: (id) => set((state) => ({
    panels: state.panels.map(p => p.id === id ? { ...p, isOpen: !p.isOpen } : p)
  })),
  updatePanelPosition: (id, x, y) => set((state) => ({
    panels: state.panels.map(p => p.id === id ? { ...p, x, y } : p)
  }))
}));
