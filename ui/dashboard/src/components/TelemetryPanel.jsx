import React from 'react';
import { useTelemetryStore } from '../store/telemetryStore';

export function TelemetryPanel() {
  const telemetry = useTelemetryStore(state => state.telemetry);
  const isConnected = useTelemetryStore(state => state.isConnected);

  return (
    <div className="glass-panel">
      <div className="panel-header">Telemetry Stream</div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-outline)' }}>SYSTEM STATUS</div>
        <div className="data-value" style={{ 
          color: isConnected ? 'var(--color-primary)' : 'var(--color-error)' 
        }}>
          {telemetry?.status || 'DISCONNECTED'}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-outline)' }}>Q_TARGET [Joint Angles]</div>
        <div className="data-value">
          [ {telemetry?.q_target?.map(q => q.toFixed(4)).join(', ') || '0.0000, 0.0000, 0.0000'} ]
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-outline)' }}>PERCEPTION</div>
        <div className="data-value">{telemetry?.perception || 'None'}</div>
      </div>
      
      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--color-outline-variant)' }}>
        <div style={{ fontSize: '10px', color: 'var(--color-outline)' }}>LAST PING</div>
        <div className="data-value">{telemetry?.last_update ? new Date(telemetry.last_update).toLocaleTimeString() : 'N/A'}</div>
      </div>
    </div>
  );
}
