import { useEffect, useState } from 'react';

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
