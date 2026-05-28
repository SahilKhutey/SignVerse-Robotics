import React, { useState, useEffect } from 'react';

export function FleetDashboard() {
  const [fleetStatus, setFleetStatus] = useState({
    active_nodes: 2,
    nodes: {
      "robot_alpha": { status: "WORKING", current_task: "Retargeting Pose", health: 100 },
      "robot_beta": { status: "IDLE", current_task: "None", health: 98 }
    }
  });

  const [gpuCluster, setGpuCluster] = useState({
    active_tasks: 0,
    queue_depth: 0,
    workers: 4
  });

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '24px', fontFamily: 'var(--os-font-display)', color: 'var(--os-text-primary)' }}>
          Cloud Robotics OS
        </h1>
        <p style={{ margin: '8px 0 0 0', color: 'var(--os-text-secondary)' }}>
          Distributed Swarm & Autonomy Telemetry
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Fleet Manager Panel */}
        <div style={{ flex: '1 1 300px', background: 'var(--os-bg-panel)', border: '1px solid var(--os-border-color)', borderRadius: 'var(--os-border-radius)', padding: '16px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--os-accent-primary)', textTransform: 'uppercase' }}>
            Swarm Fleet Manager
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(fleetStatus.nodes).map(([id, node]) => (
              <div key={id} style={{ background: 'var(--os-bg-workspace)', padding: '12px', borderRadius: '4px', border: '1px solid var(--os-border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--os-text-primary)' }}>{id.toUpperCase()}</strong>
                  <span style={{ 
                    color: node.status === 'WORKING' ? 'var(--os-status-success)' : 'var(--os-text-secondary)',
                    fontSize: '11px', fontWeight: 'bold' 
                  }}>
                    {node.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--os-text-secondary)', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px' }}>
                  <span>Task:</span> <span style={{ color: 'var(--os-text-primary)' }}>{node.current_task}</span>
                  <span>Health:</span> <span>{node.health}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distributed AI Cluster Panel */}
        <div style={{ flex: '1 1 300px', background: 'var(--os-bg-panel)', border: '1px solid var(--os-border-color)', borderRadius: 'var(--os-border-radius)', padding: '16px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#10b981', textTransform: 'uppercase' }}>
            Distributed Inference Cluster
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            <div style={{ background: 'var(--os-bg-workspace)', padding: '16px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', color: 'var(--os-text-primary)', fontFamily: 'var(--os-font-mono)' }}>{gpuCluster.workers}</div>
              <div style={{ fontSize: '11px', color: 'var(--os-text-secondary)', marginTop: '4px' }}>GPU WORKERS</div>
            </div>

            <div style={{ background: 'var(--os-bg-workspace)', padding: '16px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', color: 'var(--os-text-primary)', fontFamily: 'var(--os-font-mono)' }}>{gpuCluster.queue_depth}</div>
              <div style={{ fontSize: '11px', color: 'var(--os-text-secondary)', marginTop: '4px' }}>QUEUE DEPTH</div>
            </div>

          </div>

          <div style={{ marginTop: '24px' }}>
             <div style={{ fontSize: '11px', color: 'var(--os-text-secondary)', marginBottom: '8px' }}>Active AI Pipelines</div>
             <div style={{ fontSize: '12px', color: 'var(--os-status-idle)', fontStyle: 'italic' }}>Waiting for tasks...</div>
          </div>
        </div>

      </div>

    </div>
  );
}
