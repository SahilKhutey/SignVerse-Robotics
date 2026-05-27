import os
import shutil
import json

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"
app_dir = os.path.join(base_dir, "apps/dashboard-web")

def write_file(path, content):
    full_path = os.path.join(app_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. Next.js App Router Reconstruction
if os.path.exists(app_dir):
    shutil.rmtree(app_dir)
os.makedirs(app_dir, exist_ok=True)

write_file("package.json", json.dumps({
  "name": "dashboard-web",
  "version": "0.1.0",
  "private": True,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "14.2.3",
    "lucide-react": "^0.378.0",
    "react-grid-layout": "^1.4.4",
    "zustand": "^4.5.2",
    "tailwindcss": "^3.4.3",
    "postcss": "^8.4.38",
    "autoprefixer": "^10.4.19",
    "@signverse/sdk": "workspace:*",
    "@signverse/state": "workspace:*",
    "@signverse/api-contracts": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "@types/react": "^18.3.2",
    "@types/react-dom": "^18.3.0",
    "@types/react-grid-layout": "^1.3.5",
    "typescript": "^5.4.5"
  }
}, indent=2))

write_file("tsconfig.json", json.dumps({
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": True,
    "skipLibCheck": True,
    "strict": True,
    "noEmit": True,
    "esModuleInterop": True,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": True,
    "isolatedModules": True,
    "jsx": "preserve",
    "incremental": True,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}, indent=2))

write_file("postcss.config.js", """module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
""")

write_file("tailwind.config.ts", """import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/widgets/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/layouts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        foreground: "#ededed",
      },
    },
  },
  plugins: [],
};
export default config;
""")

write_file("src/app/globals.css", """@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  color: var(--foreground);
  background: var(--background);
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* React Grid Layout Overrides */
.react-grid-layout {
  position: relative;
  transition: height 200ms ease;
}
.react-grid-item {
  transition: all 200ms ease;
  transition-property: left, top;
}
.react-grid-item.cssTransforms {
  transition-property: transform;
}
.react-grid-item.resizing {
  z-index: 1;
  will-change: width, height;
}
.react-grid-item.react-draggable-dragging {
  transition: none;
  z-index: 3;
  will-change: transform;
}
.react-grid-item.react-grid-placeholder {
  background: rgba(0, 122, 204, 0.2);
  opacity: 0.2;
  transition-duration: 100ms;
  z-index: 2;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -o-user-select: none;
  user-select: none;
}
""")

write_file("src/app/layout.tsx", """import "./globals.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export const metadata = {
  title: "SignVerse Robotics OS",
  description: "Mission Control Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground h-screen w-screen overflow-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
""")

write_file("src/app/page.tsx", """import MissionControlWorkspace from "@/workspaces/MissionControlWorkspace";

export default function Home() {
  return (
    <main className="h-full w-full">
      <MissionControlWorkspace />
    </main>
  );
}
""")

# 2. State & Layout Engine
write_file("src/stores/workspace-store.ts", """import { create } from 'zustand';
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
""")

write_file("src/layouts/DashboardShell.tsx", """'use client';
import React from 'react';

export const DashboardShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <header className="flex justify-between items-center px-4 py-2 bg-[#111] border-b border-[#333]">
        <h1 className="text-sm font-semibold tracking-wider text-gray-300">SIGNVERSE // MISSION CONTROL</h1>
        <div className="flex gap-2">
          <div className="text-xs bg-green-900/30 text-green-500 px-2 py-1 rounded border border-green-900/50">SYSTEM ONLINE</div>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-12 bg-[#111] border-r border-[#333] flex flex-col items-center py-4">
          {/* Sidebar Icons Placeholder */}
          <div className="w-8 h-8 bg-[#222] rounded mb-2 flex items-center justify-center text-xs text-gray-500">M</div>
          <div className="w-8 h-8 hover:bg-[#222] rounded mb-2 flex items-center justify-center text-xs text-gray-500 cursor-pointer">AI</div>
        </aside>
        <main className="flex-1 overflow-auto bg-[#0a0a0a]">
          {children}
        </main>
      </div>
      <footer className="h-6 bg-[#007ACC] text-white flex items-center px-2 text-[10px] font-mono tracking-wide">
        WS: CONNECTED | GPU: READY | ROS: DISCONNECTED
      </footer>
    </div>
  );
};
""")

write_file("src/layouts/GridLayout.tsx", """'use client';
import React from 'react';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { DashboardWidget } from '@/widgets/DashboardWidget';

const ReactGridLayout = WidthProvider(RGL);

export const GridLayout = () => {
  const { widgets, layout, setLayout } = useWorkspaceStore();

  return (
    <ReactGridLayout
      className="layout"
      layout={layout}
      cols={12}
      rowHeight={100}
      width={1200}
      onLayoutChange={setLayout}
      draggableHandle=".widget-drag-handle"
      margin={[16, 16]}
    >
      {widgets.map(w => (
        <div key={w.id} className="bg-[#1e1e1e] border border-[#333] rounded-md overflow-hidden flex flex-col shadow-xl">
          <DashboardWidget id={w.id} type={w.type} title={w.title} />
        </div>
      ))}
    </ReactGridLayout>
  );
};
""")

# 3. Widgets
write_file("src/widgets/DashboardWidget.tsx", """import React from 'react';
import { TelemetryWidget } from './TelemetryWidget';
import { TerminalWidget } from './TerminalWidget';

export const DashboardWidget = ({ id, type, title }: { id: string, type: string, title: string }) => {
  const renderWidgetContent = () => {
    switch(type) {
      case 'telemetry': return <TelemetryWidget />;
      case 'terminal': return <TerminalWidget />;
      case 'viewport': return <div className="p-4 text-gray-500 h-full flex items-center justify-center">[ 3D VIEWPORT ]</div>;
      default: return <div className="text-red-500">Unknown Widget</div>;
    }
  };

  return (
    <>
      <div className="widget-drag-handle bg-[#252526] px-3 py-1.5 border-b border-[#333] flex justify-between items-center cursor-move">
        <span className="text-xs font-semibold text-gray-400">{title}</span>
        <button className="text-gray-600 hover:text-white text-xs">✕</button>
      </div>
      <div className="flex-1 overflow-auto relative">
        {renderWidgetContent()}
      </div>
    </>
  );
};
""")

write_file("src/widgets/TelemetryWidget.tsx", """import React from 'react';

export const TelemetryWidget = () => {
  return (
    <div className="p-4 font-mono text-sm">
      <div className="flex justify-between mb-2">
        <span className="text-gray-500">FPS</span>
        <span className="text-green-500">60.0</span>
      </div>
      <div className="flex justify-between mb-2">
        <span className="text-gray-500">Latency</span>
        <span className="text-green-500">12ms</span>
      </div>
      <div className="flex justify-between mb-2">
        <span className="text-gray-500">GPU VRAM</span>
        <span className="text-green-500">4.2 GB</span>
      </div>
      <div className="flex justify-between mb-2">
        <span className="text-gray-500">Status</span>
        <span className="text-green-500">ACTIVE</span>
      </div>
    </div>
  );
};
""")

write_file("src/widgets/TerminalWidget.tsx", """import React from 'react';

export const TerminalWidget = () => {
  return (
    <div className="p-4 font-mono text-[11px] text-green-500 bg-black h-full overflow-y-auto">
      <div className="mb-1">{'>'} [System] Initializing OS...</div>
      <div className="mb-1">{'>'} [System] Connecting to Inference Gateway...</div>
      <div className="mb-1">{'>'} [Inference] MediaPipe pipeline loaded.</div>
      <div className="mb-1">{'>'} [Inference] YOLOv8 tracking started.</div>
    </div>
  );
};
""")

# 4. Workspace
write_file("src/workspaces/MissionControlWorkspace.tsx", """import React from 'react';
import { DashboardShell } from '@/layouts/DashboardShell';
import { GridLayout } from '@/layouts/GridLayout';

export default function MissionControlWorkspace() {
  return (
    <DashboardShell>
      <GridLayout />
    </DashboardShell>
  );
}
""")

print("Next.js App Router migration completed.")
