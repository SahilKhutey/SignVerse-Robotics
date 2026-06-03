import React, { useEffect, useState, useRef } from 'react';
import { wsClient } from '../../lib/wsClient';
import { useTelemetryStore } from '../../store/telemetry';
import { WSMessage } from '@signverse/shared-types';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

export default function WSLatencyMeter() {
  const wsState = useTelemetryStore((state) => state.wsState);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of pending pings to calculate RTT
  const pendingPingsRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (wsState !== 'LIVE') {
      setCurrentLatency(null);
      setLatencyHistory([]);
      return;
    }

    // Subscribe to WebSocket messages
    const unsubscribe = wsClient.onMessage((msg: WSMessage) => {
      if (msg.type === 'pong') {
        const receivedAt = performance.now();
        const sentAt = msg.ts;
        const rtt = Math.round(receivedAt - sentAt);
        
        if (rtt >= 0 && rtt < 1000) { // filter outliers
          setCurrentLatency(rtt);
          setLatencyHistory((prev) => {
            const next = [...prev, rtt];
            if (next.length > 10) next.shift(); // maintain 10-sample rolling window
            return next;
          });
        }
      }
    });

    // Periodically send ping packets
    pingIntervalRef.current = setInterval(() => {
      const sentTime = performance.now();
      wsClient.send({ action: 'ping', ts: sentTime });
    }, 1000); // Ping every 1 second

    return () => {
      unsubscribe();
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [wsState]);

  // Compute rolling average
  const rollingAverage = latencyHistory.length > 0 
    ? Math.round(latencyHistory.reduce((sum, val) => sum + val, 0) / latencyHistory.length)
    : null;

  // Determine color coding & label
  let latencyColor = 'text-text-muted';
  let latencyStatus = 'OFFLINE';
  let dotColor = 'bg-text-muted';

  if (wsState === 'LIVE') {
    if (rollingAverage === null) {
      latencyColor = 'text-accent-cyan';
      latencyStatus = 'MEASURING...';
      dotColor = 'bg-accent-cyan';
    } else if (rollingAverage < 5) {
      latencyColor = 'text-accent-green';
      latencyStatus = 'EXCELLENT';
      dotColor = 'bg-accent-green';
    } else if (rollingAverage <= 20) {
      latencyColor = 'text-amber-400';
      latencyStatus = 'STABLE';
      dotColor = 'bg-amber-400';
    } else {
      latencyColor = 'text-accent-red';
      latencyStatus = 'HIGH LATENCY';
      dotColor = 'bg-accent-red';
    }
  }

  return (
    <Card id="ws-latency-card" className="glass-panel overflow-hidden relative">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          {wsState === 'LIVE' ? (
            <Wifi size={16} className={latencyColor} />
          ) : (
            <WifiOff size={16} className="text-accent-red" />
          )}
          <CardTitle>WS TELEMETRY LATENCY</CardTitle>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[8px] tracking-widest text-text-secondary uppercase">
          CONNECTION STATE: 
          <span className={`px-1.5 py-0.5 rounded font-bold ${
            wsState === 'LIVE' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red animate-pulse'
          }`}>
            {wsState}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
              10-Sample Rolling Avg
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span id="latency-value-display" className={`font-mono text-3xl font-black ${latencyColor}`}>
                {rollingAverage !== null ? rollingAverage : '--'}
              </span>
              <span className="text-xs font-semibold text-text-muted">ms</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
              <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
              <span id="latency-status-display" className={`font-mono text-[9px] font-bold ${latencyColor}`}>
                {latencyStatus}
              </span>
            </div>
            {wsState === 'LIVE' && currentLatency !== null && (
              <span className="text-[8px] font-mono text-text-muted">
                Last payload RTT: {currentLatency}ms
              </span>
            )}
          </div>
        </div>

        {/* Visual history chart (10 bars representing latency samples) */}
        <div className="flex items-end justify-between h-8 bg-black/30 border border-white/5 rounded-md p-1.5 gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => {
            const val = latencyHistory[i] ?? 0;
            const heightPct = val > 0 ? Math.min((val / 40) * 100, 100) : 4;
            const barBg = val === 0 
              ? 'bg-white/5' 
              : val < 5 
                ? 'bg-accent-green' 
                : val <= 20 
                  ? 'bg-amber-400' 
                  : 'bg-accent-red';

            return (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all duration-300 ${barBg}`}
                style={{ height: `${heightPct}%` }}
                title={val > 0 ? `${val}ms` : undefined}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
