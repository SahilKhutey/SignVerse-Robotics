import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. & 2. State Management & Real-Time Bus (Zustand Store for Layout)
write_file("packages/ui/store/layoutStore.ts", """import { create } from 'zustand';

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
""")

# 1. Dockable Layout Engine
write_file("packages/ui/layout/DashboardLayout.tsx", """import React from 'react';
import { useLayoutStore } from '../store/layoutStore';

export const DashboardLayout = ({ children, renderWidget }: { children?: React.ReactNode, renderWidget: (id: string) => React.ReactNode }) => {
  const panels = useLayoutStore(state => state.panels);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0A0A0A', color: '#FFF', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ padding: '12px 24px', backgroundColor: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '1px' }}>Sign-Verse OS // Mission Control</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {panels.map(p => (
            <button key={p.id} onClick={() => useLayoutStore.getState().togglePanel(p.id)}
              style={{ background: p.isOpen ? '#007ACC' : '#333', color: '#FFF', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}>
              {p.title}
            </button>
          ))}
        </div>
      </header>
      
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '16px', padding: '16px' }}>
        {panels.filter(p => p.isOpen).map(p => (
          <div key={p.id} style={{ 
            gridColumn: `span ${p.w}`, 
            gridRow: `span ${p.h}`,
            backgroundColor: '#1E1E1E', 
            borderRadius: '8px', 
            border: '1px solid #333',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ backgroundColor: '#252526', padding: '8px 12px', fontSize: '12px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ fontWeight: 600, color: '#AAA' }}>{p.title}</span>
               <button onClick={() => useLayoutStore.getState().togglePanel(p.id)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer'}}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
               {renderWidget(p.id)}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};
""")

# 3. Modular Widget System
write_file("packages/ui/widgets/TelemetryWidget.tsx", """import React from 'react';
import { TelemetryValue } from '../index';

export const TelemetryWidget = ({ data }: { data: any }) => {
  return (
    <div style={{ padding: '16px' }}>
       <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#888' }}>System Vitals</h3>
       <TelemetryValue label="FPS" value={data?.fps || "60.0"} />
       <TelemetryValue label="Latency" value={data?.latency || "12ms"} />
       <TelemetryValue label="GPU VRAM" value={data?.vram || "4.2 GB"} />
       <TelemetryValue label="Active Workers" value={data?.workers || "3"} />
       <TelemetryValue label="Robot Status" value={data?.status || "IDLE"} />
    </div>
  );
};
""")

write_file("packages/ui/widgets/TerminalWidget.tsx", """import React, { useEffect, useRef } from 'react';

export const TerminalWidget = ({ logs }: { logs: string[] }) => {
  const endRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={{ padding: '16px', fontFamily: 'monospace', fontSize: '12px', color: '#0F0', height: '100%', overflowY: 'auto', backgroundColor: '#000' }}>
       {logs.map((log, i) => (
         <div key={i} style={{ marginBottom: '4px' }}>{`> ${log}`}</div>
       ))}
       <div ref={endRef} />
    </div>
  );
};
""")

# 2. Update packages/ui/index.tsx to export new modules
write_file("packages/ui/index.tsx", """import * as React from "react";

// Components
export const Card = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: '#1E1E1E', padding: '1rem', borderRadius: '8px', color: 'white', border: '1px solid #333' }}>
    {children}
  </div>
);

export const TelemetryValue = ({ label, value }: { label: string, value: string | number }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', margin: '4px 0' }}>
    <span style={{ color: '#888' }}>{label}</span>
    <span style={{ color: '#0F0' }}>{value}</span>
  </div>
);

// Layout & Store
export * from './layout/DashboardLayout';
export * from './store/layoutStore';

// Widgets
export * from './widgets/TelemetryWidget';
export * from './widgets/TerminalWidget';
""")

# 2. AI SDK WebSocket Hooks
write_file("packages/ai-sdk/hooks/useRealtimeStream.ts", """import { useEffect, useState } from 'react';

export const useRealtimeStream = (url: string) => {
  const [telemetry, setTelemetry] = useState<any>({});
  const [logs, setLogs] = useState<string[]>(['[System] WebSocket initialized', '[System] Connecting to AI Gateway...']);

  useEffect(() => {
    // In production, this connects to the FastAPI websocket.
    // For MVP/UI building, we simulate incoming telemetry stream.
    const interval = setInterval(() => {
      setTelemetry({
        fps: (58 + Math.random() * 4).toFixed(1),
        latency: (10 + Math.random() * 5).toFixed(1) + 'ms',
        vram: (4.0 + Math.random() * 0.5).toFixed(1) + ' GB',
        workers: 3,
        status: "ACTIVE"
      });
      
      if (Math.random() > 0.8) {
        setLogs(prev => [...prev.slice(-20), `[Inference] Processed frame ${Math.floor(Math.random() * 1000)}...`]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [url]);

  return { telemetry, logs };
};
""")

write_file("packages/ai-sdk/index.ts", """export * from './hooks/useRealtimeStream';

export class SignVerseAIClient {
  private url: string;
  constructor(url: string) {
    this.url = url;
  }
  
  async ping() {
    return fetch(`${this.url}/health`).then(res => res.json());
  }
}
""")

# 4. Mission Control App Reconstruction
write_file("apps/dashboard-web/src/App.tsx", """import React from 'react';
import { DashboardLayout, TelemetryWidget, TerminalWidget } from '@signverse/ui';
import { useRealtimeStream } from '@signverse/ai-sdk';
// import { Viewer } from './three/Viewer'; // Future 3D Viewer Integration

function App() {
  const { telemetry, logs } = useRealtimeStream('ws://localhost:8000/ws');

  const renderWidget = (id: string) => {
    switch(id) {
      case 'telemetry':
        return <TelemetryWidget data={telemetry} />;
      case 'terminal':
        return <TerminalWidget logs={logs} />;
      case 'viewport':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
            {/* <Viewer /> */}
            [3D React-Three-Fiber Simulation Viewport]
          </div>
        );
      default:
        return <div style={{ padding: '16px', color: 'red' }}>Unknown Widget: {id}</div>;
    }
  };

  return (
    <DashboardLayout renderWidget={renderWidget} />
  );
}

export default App;
""")

print("Sprint 2 Dashboard Core and Layout Engine scaffolded.")
