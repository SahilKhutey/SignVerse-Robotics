import React, { useState, useEffect } from 'react';
import { useTelemetryStore } from './store/telemetryStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { SimulationPanel } from './components/studios/SimulationPanel';
import { CaptureStudio, DatasetManager, TimelineEditor, RetargetingStudio, TrainingMonitor } from './components/studios';
import { PipelineEditor } from './components/pipeline/PipelineEditor';
import { FleetDashboard } from './components/studios/FleetDashboard';
import { CommandMatrix } from './components/studios/CommandMatrix';

function App() {
  const WS_URL = 'ws://localhost:8000/ws/telemetry';
  
  // Global Stores
  const connectTelemetry = useTelemetryStore(state => state.connect);
  const disconnectTelemetry = useTelemetryStore(state => state.disconnect);
  const activeProject = useWorkspaceStore(state => state.activeProject);

  const [activeModule, setActiveModule] = useState('genesis');

  // Boot OS Telemetry on Mount
  useEffect(() => {
    connectTelemetry(WS_URL);
    return () => disconnectTelemetry();
  }, [connectTelemetry, disconnectTelemetry]);

  // Layout Modules
  const renderMainViewport = () => {
    switch (activeModule) {
      case 'genesis': return <CommandMatrix />;
      case 'fleet': return <FleetDashboard />;
      case 'pipeline': return <PipelineEditor />;
      case 'capture': return <CaptureStudio />;
      case 'dataset': return <DatasetManager />;
      case 'timeline': return <TimelineEditor />;
      case 'simulation': return <SimulationPanel />;
      case 'retargeting': return <RetargetingStudio />;
      case 'training': return <TrainingMonitor />;
      default: return <CommandMatrix />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: 'var(--os-bg-base)', color: 'var(--os-text-primary)' }}>
      
      {/* OS Topbar */}
      <header style={{ height: 'var(--os-topbar-height)', backgroundColor: 'var(--os-bg-panel)', borderBottom: '1px solid var(--os-border-color)', display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontFamily: 'var(--os-font-display)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em', color: 'var(--os-accent-primary)' }}>SIGNVERSE OS</span>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--os-border-color)' }}></div>
          <span style={{ fontSize: '12px', color: 'var(--os-text-secondary)', fontFamily: 'var(--os-font-mono)' }}>Workspace: {activeProject.name}</span>
        </div>
        
        {/* Module Switcher (Temporary Top Navigation) */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['genesis', 'fleet', 'pipeline', 'capture', 'dataset', 'timeline', 'simulation', 'retargeting', 'training'].map(mod => (
            <button 
              key={mod}
              onClick={() => setActiveModule(mod)}
              style={{
                background: activeModule === mod ? 'var(--os-accent-glow)' : 'transparent',
                border: activeModule === mod ? '1px solid var(--os-accent-primary)' : '1px solid transparent',
                color: activeModule === mod ? 'var(--os-accent-primary)' : 'var(--os-text-muted)',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                textTransform: 'uppercase',
                fontFamily: 'var(--os-font-mono)',
                cursor: 'pointer'
              }}
            >
              {mod}
            </button>
          ))}
        </div>
      </header>

      {/* Main OS Layout Grid */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Dock: Scene Graph / Asset Explorer */}
        <aside style={{ width: 'var(--os-sidebar-width)', backgroundColor: 'var(--os-bg-panel)', borderRight: '1px solid var(--os-border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--os-border-color)', fontSize: '10px', textTransform: 'uppercase', fontFamily: 'var(--os-font-mono)', color: 'var(--os-text-muted)', letterSpacing: '0.1em' }}>
            Pipeline Explorer
          </div>
          <div style={{ flex: 1, padding: '16px' }}>
            {/* Tree view of active node graph will go here */}
            <div style={{ fontSize: '12px', color: 'var(--os-text-secondary)' }}>No active nodes</div>
          </div>
        </aside>

        {/* Center: Main Viewport */}
        <main style={{ flex: 1, backgroundColor: 'var(--os-bg-viewport)', position: 'relative', overflow: 'hidden' }}>
          {renderMainViewport()}
        </main>

        {/* Right Dock: Properties / Telemetry */}
        <aside style={{ width: '320px', backgroundColor: 'var(--os-bg-panel)', borderLeft: '1px solid var(--os-border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--os-border-color)', fontSize: '10px', textTransform: 'uppercase', fontFamily: 'var(--os-font-mono)', color: 'var(--os-text-muted)', letterSpacing: '0.1em' }}>
            Telemetry & Properties
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Global Telemetry Panel can be mounted here eventually, removing it from inner modules */}
          </div>
        </aside>

      </div>

      {/* Bottom Dock: Timeline / Output Console */}
      <footer style={{ height: 'var(--os-bottombar-height)', backgroundColor: 'var(--os-bg-panel)', borderTop: '1px solid var(--os-border-color)', display: 'flex', flexDirection: 'column' }}>
         <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--os-border-color)', fontSize: '10px', textTransform: 'uppercase', fontFamily: 'var(--os-font-mono)', color: 'var(--os-text-muted)', letterSpacing: '0.1em', display: 'flex', gap: '16px' }}>
            <span style={{ color: 'var(--os-text-primary)' }}>Console Output</span>
            <span>Job Queue</span>
            <span>Timeline</span>
          </div>
          <div style={{ flex: 1, padding: '16px', fontFamily: 'var(--os-font-mono)', fontSize: '11px', color: 'var(--os-text-secondary)', overflowY: 'auto' }}>
            > SignVerse OS Kernel initialized...<br/>
            > Waiting for pipeline execution...
          </div>
      </footer>

    </div>
  );
}

export default App;
