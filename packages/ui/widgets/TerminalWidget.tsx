import React, { useEffect, useRef } from 'react';

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
