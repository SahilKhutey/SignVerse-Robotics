import React from 'react';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { Activity, Shield, Clock, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

export default function SystemStatusCard() {
  const { data: status, isLoading, error } = useSystemStatus();

  if (isLoading) {
    return (
      <Card id="system-status-card" className="glass-panel overflow-hidden relative p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-white/5 shimmer-loader" />
            <div className="h-4 w-28 rounded bg-white/5 shimmer-loader" />
          </div>
          <div className="h-4 w-16 rounded bg-white/5 shimmer-loader" />
        </div>
        <div className="pt-2 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-14 rounded bg-white/5 shimmer-loader" />
            <div className="h-14 rounded bg-white/5 shimmer-loader" />
          </div>
          <div className="h-8 rounded bg-white/5 shimmer-loader" />
        </div>
      </Card>
    );
  }

  const isRunning = status?.kernel === 'running';
  const uptimeSeconds = status?.uptime ?? 0;


  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Card id="system-status-card" className="glass-panel overflow-hidden relative">
      {/* Scanline premium overlay */}
      {isRunning && <div className="scan-line" />}
      
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity size={16} className={isRunning ? "text-accent-green" : "text-accent-red"} />
          <CardTitle>KERNEL HEARTBEAT</CardTitle>
        </div>
        <Badge 
          id="kernel-status-badge"
          variant={isRunning ? "success" : "destructive"} 
          className="uppercase tracking-widest text-[9px] px-2 py-0.5 animate-pulse"
        >
          {isRunning ? "RUNNING" : "STOPPED"}
        </Badge>
      </CardHeader>

      <CardContent className="pt-5 flex flex-col gap-4">
        {/* Heartbeat Status Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-all">
            <span className="text-[9px] text-text-secondary uppercase font-display tracking-wider flex items-center gap-1.5">
              <Clock size={11} className="text-accent-cyan" /> UPTIME
            </span>
            <span id="uptime-display" className="font-mono text-lg font-bold text-text-primary">
              {formatUptime(uptimeSeconds)}
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-all">
            <span className="text-[9px] text-text-secondary uppercase font-display tracking-wider flex items-center gap-1.5">
              <RefreshCw size={11} className="text-accent-violet" /> KERNEL LOOP RATE
            </span>
            <span className="font-mono text-lg font-bold text-text-primary flex items-baseline gap-1">
              <span id="actual-hz-display">{isRunning ? status?.loopFrequency?.actual ?? 0 : 0}</span>
              <span className="text-[9px] text-text-muted">/ {status?.loopFrequency?.target ?? 1000} Hz</span>
            </span>
          </div>
        </div>

        {/* Diagnostic note */}
        <div className="text-[9px] text-text-secondary font-mono bg-black/40 border border-white/5 p-2.5 rounded-md">
          {error ? (
            <span className="text-accent-red">⚠️ Unable to communicate with core FastAPI system gateway.</span>
          ) : isLoading ? (
            <span className="text-accent-cyan animate-pulse">Connecting to system core telemetry...</span>
          ) : isRunning ? (
            <span className="text-accent-green">✓ System kernel thread executing and broadcasting telemetry frames cleanly.</span>
          ) : (
            <span className="text-accent-red">⚠️ Gateway online but system kernel has stopped execution.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
