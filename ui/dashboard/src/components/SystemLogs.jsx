import React, { useEffect, useRef } from 'react';

export function SystemLogs({ logs }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">System Logs</div>
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          fontFamily: 'var(--font-console)', 
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        {logs.map((log, idx) => (
          <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
            <span style={{ color: 'var(--color-outline)', marginRight: '8px' }}>
              {log.timestamp.split('T')[1].substring(0, 12)}
            </span>
            <span style={{ 
              color: log.level === 'ERROR' ? 'var(--color-error)' : 
                     log.level === 'WARNING' ? 'orange' : 'var(--color-primary)',
              marginRight: '8px'
            }}>
              [{log.level}]
            </span>
            <span style={{ color: 'var(--color-on-surface)' }}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
