import { useState, useEffect } from 'react';

export function useTelemetry(url) {
  const [data, setData] = useState({
    status: 'DISCONNECTED',
    q_target: [0.0, 0.0, 0.0],
    perception: 'Waiting...',
    last_update: Date.now()
  });
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    let ws;
    
    const connect = () => {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        setData(prev => ({ ...prev, status: 'CONNECTED' }));
        addLog('SYSTEM', 'WebSocket Connected to ' + url);
      };
      
      let lastUpdateTimestamp = 0;
      const THROTTLE_MS = 16; // ~60 FPS

      ws.onmessage = (event) => {
        try {
          const now = Date.now();
          if (now - lastUpdateTimestamp < THROTTLE_MS) {
            // Drop frame if coming in too fast
            return;
          }
          lastUpdateTimestamp = now;

          const payload = JSON.parse(event.data);
          // Assuming the API sends { status, q_target, perception }
          setData({
            ...payload,
            last_update: now
          });
        } catch (e) {
          addLog('ERROR', 'Failed to parse telemetry');
        }
      };
      
      ws.onclose = () => {
        setData(prev => ({ ...prev, status: 'DISCONNECTED' }));
        addLog('WARNING', 'WebSocket Disconnected. Reconnecting in 2s...');
        setTimeout(connect, 2000);
      };
      
      ws.onerror = (err) => {
        addLog('ERROR', 'WebSocket encountered an error');
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, [url]);

  const addLog = (level, message) => {
    setLogs(prev => {
      const newLogs = [...prev, { timestamp: new Date().toISOString(), level, message }];
      if (newLogs.length > 50) newLogs.shift();
      return newLogs;
    });
  };

  return { data, logs, addLog };
}
