import React, { useState } from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import { SimulationPanel } from './components/studios/SimulationPanel';
import { 
  CaptureStudio, 
  DatasetManager, 
  TimelineEditor, 
  RetargetingStudio, 
  TrainingMonitor 
} from './components/studios';

function App() {
  const WS_URL = 'ws://localhost:8000/ws/telemetry';
  const API_URL = 'http://localhost:8000/api/command';
  
  const { data: telemetry, logs, addLog } = useTelemetry(WS_URL);
  const [apiError, setApiError] = useState(null);
  const [activeTab, setActiveTab] = useState('simulation');

  const handleCommandSend = async (command, apiKey) => {
    setApiError(null);
    try {
      addLog('SYSTEM', 'Sending command to AI Agent: ' + command);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ command })
      });
      
      if (response.status === 403) {
         setApiError('Invalid API Key (403 Forbidden)');
         addLog('ERROR', 'Authentication failed (403 Forbidden)');
         return;
      }
      
      const result = await response.json();
      if (result.status === 'success') {
        const agentOut = result.agent_output;
        addLog('AGENT', `Intent: ${agentOut.intent} | Skills: ${agentOut.required_skills.join(', ')}`);
      } else {
        addLog('ERROR', 'Agent reasoning failed.');
      }
    } catch (error) {
      setApiError(error.message);
      addLog('ERROR', 'Failed to reach API: ' + error.message);
    }
  };

  const tabs = [
    { id: 'capture', label: 'Capture Studio', icon: '🎥' },
    { id: 'dataset', label: 'Dataset Manager', icon: '🗄️' },
    { id: 'timeline', label: 'Motion Timeline Editor', icon: '⏱️' },
    { id: 'simulation', label: '2D/3D Simulation & Export Viewport', icon: '🌐' },
    { id: 'retargeting', label: 'Robot Retargeting Studio', icon: '🤖' },
    { id: 'training', label: 'Training Monitor', icon: '📈' },
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">SignVerse</h1>
          <div className="sidebar-subtitle">Robotics Motion Platform</div>
        </div>
        
        <nav className="nav-menu">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Workspace Area */}
      <main className="main-workspace">
        <header className="workspace-header">
          <h2 className="workspace-title">
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
        </header>
        
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {activeTab === 'capture' && <CaptureStudio />}
          {activeTab === 'dataset' && <DatasetManager />}
          {activeTab === 'timeline' && <TimelineEditor />}
          {activeTab === 'simulation' && (
            <SimulationPanel 
              telemetry={telemetry} 
              logs={logs} 
              onCommandSend={handleCommandSend} 
              apiError={apiError} 
            />
          )}
          {activeTab === 'retargeting' && <RetargetingStudio />}
          {activeTab === 'training' && <TrainingMonitor />}
        </div>
      </main>
    </div>
  );
}

export default App;
