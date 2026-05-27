import { create } from 'zustand';
import { Layout } from 'react-grid-layout';

export interface WidgetInstance {
  id: string;
  type: string;
  title: string;
}

interface WorkspaceState {
  widgets: WidgetInstance[];
  layout: Layout[];
  setLayout: (layout: Layout[]) => void;
  addWidget: (widget: WidgetInstance, layout: Layout) => void;
  removeWidget: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  widgets: [
    { id: 'sim-1', type: 'viewport', title: '3D Simulation' },
    { id: 'tel-1', type: 'telemetry', title: 'System Vitals' },
    { id: 'log-1', type: 'terminal', title: 'AI Logs' }
  ],
  layout: [
    { i: 'sim-1', x: 0, y: 0, w: 8, h: 4 },
    { i: 'tel-1', x: 8, y: 0, w: 4, h: 2 },
    { i: 'log-1', x: 8, y: 2, w: 4, h: 2 }
  ],
  setLayout: (layout) => set({ layout }),
  addWidget: (widget, layoutDef) => set((state) => ({
    widgets: [...state.widgets, widget],
    layout: [...state.layout, layoutDef]
  })),
  removeWidget: (id) => set((state) => ({
    widgets: state.widgets.filter(w => w.id !== id),
    layout: state.layout.filter(l => l.i !== id)
  }))
}));
