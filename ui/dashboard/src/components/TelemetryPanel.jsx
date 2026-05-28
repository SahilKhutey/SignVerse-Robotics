import React from 'react';

export function TelemetryPanel({ telemetry }) {
  return (
    <div className="glass-panel">
      <div className="panel-header">Telemetry Stream</div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-outline)' }}>SYSTEM STATUS</div>
        <div className="data-value" style={{ 
          color: telemetry.status === 'CONNECTED' ? 'var(--color-primary)' : 'var(--color-error)' 
        }}>
          {telemetry.status}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-outline)' }}>Q_TARGET [Joint Angles]</div>
        <div className="data-value">
          [ {telemetry.q_target?.map(q => q.toFixed(4)).join(', ')} ]
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-outline)' }}>PERCEPTION</div>
        <div className="data-value">{telemetry.perception || 'None'}</div>
      </div>
      
      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--color-outline-variant)' }}>
        <div style={{ fontSize: '10px', color: 'var(--color-outline)' }}>LAST PING</div>
        <div className="data-value">{new Date(telemetry.last_update).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
