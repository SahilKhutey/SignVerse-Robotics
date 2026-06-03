import React from 'react';
import { usePerformanceStore } from '../store/performance';
import { Activity, Cpu, Clock, HardDrive, LineChart, ShieldCheck, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PerformancePage() {
  const metrics = usePerformanceStore((state) => state.metrics);

  const getLatencyColor = (val: number | null) => {
    if (val === null) return 'text-text-muted border-white/5';
    if (val < 15) return 'text-accent-green border-accent-green/20 bg-accent-green/5';
    if (val < 50) return 'text-amber-400 border-amber-400/20 bg-amber-400/5';
    return 'text-accent-red border-accent-red/20 bg-accent-red/5';
  };

  const getFpsColor = (val: number) => {
    if (val >= 55) return 'text-accent-green border-accent-green/20 bg-accent-green/5';
    if (val >= 45) return 'text-amber-400 border-amber-400/20 bg-amber-400/5';
    return 'text-accent-red border-accent-red/20 bg-accent-red/5';
  };

  const getCmdColor = (val: number | null) => {
    if (val === null) return 'text-text-muted border-white/5';
    if (val < 100) return 'text-accent-green border-accent-green/20 bg-accent-green/5';
    if (val < 300) return 'text-amber-400 border-amber-400/20 bg-amber-400/5';
    return 'text-accent-red border-accent-red/20 bg-accent-red/5';
  };

  const getLcpColor = (val: number | null) => {
    if (val === null) return 'text-text-muted bg-white/3';
    if (val < 2500) return 'text-accent-green bg-accent-green/10';
    if (val < 4000) return 'text-amber-400 bg-amber-400/10';
    return 'text-accent-red bg-accent-red/10';
  };

  const getFidColor = (val: number | null) => {
    if (val === null) return 'text-text-muted bg-white/3';
    if (val < 100) return 'text-accent-green bg-accent-green/10';
    if (val < 300) return 'text-amber-400 bg-amber-400/10';
    return 'text-accent-red bg-accent-red/10';
  };

  const getClsColor = (val: number | null) => {
    if (val === null) return 'text-text-muted bg-white/3';
    if (val < 0.1) return 'text-accent-green bg-accent-green/10';
    if (val < 0.25) return 'text-amber-400 bg-amber-400/10';
    return 'text-accent-red bg-accent-red/10';
  };

  // Build chart data
  const chartData = metrics.fpsHistory.map((fps, idx) => ({
    frame: idx + 1,
    fps,
  }));

  const latencyChartData = metrics.commandLatencies.map((lat, idx) => ({
    query: idx + 1,
    latency: lat,
  }));

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6 bg-[#07080a]">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-white/5 pb-4 select-none">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-accent-cyan animate-pulse" />
          <h2 className="font-display text-sm font-bold tracking-wider text-text-primary uppercase">
            Performance Monitor
          </h2>
        </div>
        <p className="text-[10px] text-text-secondary">
          Track real-time UI render frame rates, WebSocket handshake times, NLP Cognitive execution latencies, and Core Web Vitals reported to Sentry.
        </p>
      </div>

      {/* Sleek Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* WS Connect Card */}
        <div className={`glass-panel p-5 border flex flex-col gap-4 transition-all duration-300 ${getLatencyColor(metrics.wsConnectMs)}`}>
          <div className="flex justify-between items-center select-none">
            <span className="font-display text-[9px] font-bold tracking-widest uppercase text-text-secondary">
              WS CONNECT LATENCY
            </span>
            <Activity size={14} className="opacity-75" />
          </div>
          <div className="flex items-baseline gap-1.5 py-1">
            <span className="font-display text-3xl font-extrabold tracking-tight">
              {metrics.wsConnectMs !== null ? `${metrics.wsConnectMs}` : '---'}
            </span>
            {metrics.wsConnectMs !== null && <span className="font-mono text-xs text-text-secondary">ms</span>}
          </div>
          <span className="text-[8px] font-mono text-text-secondary select-none">
            Time from instantiation to open socket.
          </span>
        </div>

        {/* Render Rate p50 Card */}
        <div className={`glass-panel p-5 border flex flex-col gap-4 transition-all duration-300 ${getFpsColor(metrics.twinFpsP50)}`}>
          <div className="flex justify-between items-center select-none">
            <span className="font-display text-[9px] font-bold tracking-widest uppercase text-text-secondary">
              RENDER RATE (p50)
            </span>
            <Cpu size={14} className="opacity-75" />
          </div>
          <div className="flex items-baseline gap-1.5 py-1">
            <span className="font-display text-3xl font-extrabold tracking-tight">
              {metrics.twinFpsP50}
            </span>
            <span className="font-mono text-xs text-text-secondary">FPS</span>
          </div>
          <span className="text-[8px] font-mono text-text-secondary select-none">
            Median R3F canvas render frame rate.
          </span>
        </div>

        {/* Command Center latency */}
        <div className={`glass-panel p-5 border flex flex-col gap-4 transition-all duration-300 ${getCmdColor(metrics.commandLatencyMs)}`}>
          <div className="flex justify-between items-center select-none">
            <span className="font-display text-[9px] font-bold tracking-widest uppercase text-text-secondary">
              CMD API LATENCY
            </span>
            <Clock size={14} className="opacity-75" />
          </div>
          <div className="flex items-baseline gap-1.5 py-1">
            <span className="font-display text-3xl font-extrabold tracking-tight">
              {metrics.commandLatencyMs !== null ? `${metrics.commandLatencyMs.toFixed(0)}` : '---'}
            </span>
            {metrics.commandLatencyMs !== null && <span className="font-mono text-xs text-text-secondary">ms</span>}
          </div>
          <span className="text-[8px] font-mono text-text-secondary select-none">
            NLP intent parsing fetch round-trip latency.
          </span>
        </div>

      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* FPS History chart */}
        <div className="glass-panel p-5 flex flex-col gap-4 min-h-[260px]">
          <div className="flex justify-between items-center border-b border-white/5 pb-2 select-none">
            <div className="flex items-center gap-1.5">
              <LineChart size={14} className="text-accent-cyan" />
              <span className="font-display text-[10px] font-bold tracking-wider text-text-primary uppercase">
                Render Frame Rate History
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyan font-mono text-[7px] font-bold">
              30-TICK ROLLING WINDOW
            </span>
          </div>
          <div className="flex-1 w-full h-[180px] pt-4 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fpsGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent-cyan)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--color-accent-cyan)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="frame" stroke="#64748b" fontSize={8} tickLine={false} />
                <YAxis domain={[0, 90]} stroke="#64748b" fontSize={8} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '9px', fontFamily: 'monospace' }}
                />
                <Area type="monotone" dataKey="fps" stroke="var(--color-accent-cyan)" strokeWidth={1.5} fillOpacity={1} fill="url(#fpsGlow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Command Latency history */}
        <div className="glass-panel p-5 flex flex-col gap-4 min-h-[260px]">
          <div className="flex justify-between items-center border-b border-white/5 pb-2 select-none">
            <div className="flex items-center gap-1.5">
              <LineChart size={14} className="text-accent-violet" />
              <span className="font-display text-[10px] font-bold tracking-wider text-text-primary uppercase">
                NLP Query Latency History
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-accent-violet/15 text-accent-violet font-mono text-[7px] font-bold">
              LAST 10 TRANSACTIONS
            </span>
          </div>
          {metrics.commandLatencies.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-muted font-mono text-[9px] select-none text-center">
              No command center queries dispatched in this session yet.
            </div>
          ) : (
            <div className="flex-1 w-full h-[180px] pt-4 pr-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyChartData}>
                  <defs>
                    <linearGradient id="latencyGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent-violet)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--color-accent-violet)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="query" stroke="#64748b" fontSize={8} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={8} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '9px', fontFamily: 'monospace' }}
                  />
                  <Area type="monotone" dataKey="latency" stroke="var(--color-accent-violet)" strokeWidth={1.5} fillOpacity={1} fill="url(#latencyGlow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

      {/* Sentry Core Web Vitals Panel */}
      <div className="glass-panel p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2 select-none">
          <ShieldCheck size={16} className="text-accent-green" />
          <h3 className="font-display text-[10px] font-bold tracking-wider text-text-primary uppercase">
            Sentry Observability & Web Vitals
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none font-sans text-left">
          
          {/* LCP card */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-white/5 bg-black/20">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-mono font-bold text-text-primary">LCP</span>
              <span className="text-[7px] text-text-secondary">Largest Contentful Paint</span>
            </div>
            <span className={`px-2 py-1 rounded font-mono text-[9px] font-bold ${getLcpColor(metrics.lcp)}`}>
              {metrics.lcp !== null ? `${(metrics.lcp / 1000).toFixed(2)}s` : 'WAITING'}
            </span>
          </div>

          {/* FID card */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-white/5 bg-black/20">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-mono font-bold text-text-primary">FID</span>
              <span className="text-[7px] text-text-secondary">First Input Delay</span>
            </div>
            <span className={`px-2 py-1 rounded font-mono text-[9px] font-bold ${getFidColor(metrics.fid)}`}>
              {metrics.fid !== null ? `${metrics.fid.toFixed(1)}ms` : 'WAITING'}
            </span>
          </div>

          {/* CLS card */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-white/5 bg-black/20">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-mono font-bold text-text-primary">CLS</span>
              <span className="text-[7px] text-text-secondary">Cumulative Layout Shift</span>
            </div>
            <span className={`px-2 py-1 rounded font-mono text-[9px] font-bold ${getClsColor(metrics.cls)}`}>
              {metrics.cls !== null ? `${metrics.cls.toFixed(3)}` : 'WAITING'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
