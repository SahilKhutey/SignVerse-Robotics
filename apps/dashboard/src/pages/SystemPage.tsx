import React, { useState, useEffect } from 'react';
import { useTelemetryStore } from '../store/telemetry';
import { Settings, Cpu, HardDrive, CheckCircle2, AlertOctagon, Terminal } from 'lucide-react';
import SystemStatusCard from '../components/system/SystemStatusCard';
import ModelLoadGrid from '../components/system/ModelLoadGrid';
import WSLatencyMeter from '../components/system/WSLatencyMeter';
import HardwarePanel from '../components/system/HardwarePanel';

interface ProcessItem {
  name: string;
  pid: number;
  status: 'running' | 'error' | 'stopped';
  cpuPct: number;
  memMb: number;
  uptime: string;
}

export default function SystemPage() {
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);
  const [processes, setProcesses] = useState<ProcessItem[]>([
    { name: 'fastapi-gateway', pid: 14201, status: 'running', cpuPct: 1.5, memMb: 124, uptime: '02h 45m' },
    { name: 'websocket-decimator', pid: 14208, status: 'running', cpuPct: 0.8, memMb: 56, uptime: '02h 45m' },
    { name: 'perception-pipeline', pid: 14210, status: 'running', cpuPct: 12.4, memMb: 1540, uptime: '02h 44m' },
    { name: 'ros-joint-driver', pid: 14225, status: 'running', cpuPct: 3.2, memMb: 92, uptime: '02h 44m' }
  ]);

  // Mock hardware compute metrics
  const [hardwareUsage, setHardwareUsage] = useState({
    cpu: 18,
    gpu: 42,
    ram: 6.2,
  });

  const [logs, setLogs] = useState<any[]>([]);

  // Connect Server-Sent Events Log Stream
  useEffect(() => {
    const defaultApiUrl = 'http://localhost:8000';
    const baseUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
    const sseUrl = `${baseUrl}/api/system/logs/stream`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const logObj = JSON.parse(event.data);
        setLogs((prev) => [...prev, logObj].slice(-100));
      } catch (err) {
        setLogs((prev) => [...prev, { event: event.data }].slice(-100));
      }
    };

    eventSource.onerror = () => {
      console.warn("Log SSE stream disconnected, attempting reconnect...");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Handle dynamic mock metrics updates for processes and utilization
  useEffect(() => {
    const interval = setInterval(() => {
      // Mock CPU/Memory fluctuations
      setProcesses((prev) =>
        prev.map((proc) => {
          if (proc.status !== 'running') return proc;
          const cpuOffset = (Math.random() - 0.5) * 2;
          const nextCpu = parseFloat(Math.max(proc.cpuPct + cpuOffset, 0.1).toFixed(1));
          return {
            ...proc,
            cpuPct: nextCpu,
            status: isEstopTriggered && proc.name === 'ros-joint-driver' ? 'error' : 'running'
          };
        })
      );

      // Fluctuating hardware stats
      setHardwareUsage((prev) => {
        const cpuOffset = (Math.random() - 0.5) * 4;
        const gpuOffset = (Math.random() - 0.5) * 6;
        return {
          cpu: Math.min(Math.max(Math.round(prev.cpu + cpuOffset), 5), 95),
          gpu: Math.min(Math.max(Math.round(prev.gpu + gpuOffset), 10), 99),
          ram: parseFloat(Math.min(Math.max(prev.ram + (Math.random() - 0.5) * 0.1, 4.0), 16.0).toFixed(1)),
        };
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isEstopTriggered]);

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6 bg-[#07080a]">
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-accent-cyan animate-spin-slow" />
          <h2 className="font-display text-sm font-bold tracking-wider text-text-primary uppercase">
            System Diagnostics
          </h2>
        </div>
        <p className="text-[10px] text-text-secondary">
          Monitor system gateways, local service process registrations, hardware compute metrics, and networking latencies.
        </p>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Left: Active Diagnostics Dashboard (Spans 2 columns) */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* Heartbeat & WS Latency Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SystemStatusCard />
            <WSLatencyMeter />
          </div>

          {/* Model Loading Status Registry */}
          <div className="flex flex-col gap-3">
            <span className="font-display text-[10px] font-bold tracking-widest text-text-muted uppercase">
              MODEL LOAD REGISTRY
            </span>
            <ModelLoadGrid />
          </div>

          {/* Hardware Sensors panel */}
          <div className="flex flex-col gap-3">
            <span className="font-display text-[10px] font-bold tracking-widest text-text-muted uppercase">
              HARDWARE COMMUNICATION BRIDGES
            </span>
            <HardwarePanel />
          </div>

        </div>

        {/* Right: Processes, Compute Util, & Raw Logs */}
        <div className="flex flex-col gap-6">
          
          {/* Compute Hardware Utilization */}
          <div className="glass-panel p-5 flex flex-col gap-4">
            <span className="font-display text-[10px] font-bold tracking-widest text-text-primary uppercase">
              COMPUTE HARDWARE UTILIZATION
            </span>

            <div className="flex flex-col gap-3.5">
              {/* CPU utilization */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="flex items-center gap-1"><Cpu size={12} className="text-accent-cyan" /> CPU UTILIZATION</span>
                  <span className="text-text-primary font-bold">{hardwareUsage.cpu}%</span>
                </div>
                <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-accent-cyan transition-all duration-500" style={{ width: `${hardwareUsage.cpu}%` }} />
                </div>
              </div>

              {/* GPU utilization */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="flex items-center gap-1"><Cpu size={12} className="text-accent-violet" /> GPU CORES</span>
                  <span className="text-text-primary font-bold">{hardwareUsage.gpu}%</span>
                </div>
                <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-accent-violet transition-all duration-500" style={{ width: `${hardwareUsage.gpu}%` }} />
                </div>
              </div>

              {/* Memory utilization */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="flex items-center gap-1"><HardDrive size={12} className="text-accent-green" /> SYSTEM RAM</span>
                  <span className="text-text-primary font-bold">{hardwareUsage.ram} GB / 16 GB</span>
                </div>
                <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-accent-green transition-all duration-500" style={{ width: `${(hardwareUsage.ram / 16.0) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Process Service Registrations */}
          <div className="glass-panel p-5 flex flex-col gap-4">
            <span className="font-display text-[10px] font-bold tracking-widest text-text-primary uppercase">
              CORE SERVER PROCESSES
            </span>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left font-mono text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-text-muted">
                    <th className="pb-2 font-display uppercase tracking-widest text-[8px]">SERVICE</th>
                    <th className="pb-2 font-display uppercase tracking-widest text-[8px]">PID</th>
                    <th className="pb-2 font-display uppercase tracking-widest text-[8px]">STATUS</th>
                    <th className="pb-2 font-display uppercase tracking-widest text-[8px]">CPU</th>
                    <th className="pb-2 font-display uppercase tracking-widest text-[8px]">MEM</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((proc, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-all">
                      <td className="py-2.5 text-accent-cyan font-bold">{proc.name}</td>
                      <td className="py-2.5 text-text-secondary">{proc.pid}</td>
                      <td className="py-2.5">
                        {proc.status === 'running' ? (
                          <span className="text-accent-green font-bold uppercase tracking-wider flex items-center gap-1 text-[8px]">
                            <CheckCircle2 size={9} />
                            ONLINE
                          </span>
                        ) : (
                          <span className="text-accent-red font-bold uppercase tracking-wider flex items-center gap-1 text-[8px] animate-pulse">
                            <AlertOctagon size={9} />
                            ERROR
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-text-primary">{proc.cpuPct}%</td>
                      <td className="py-2.5 text-text-secondary">{proc.memMb}MB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Log Console Terminal Stream */}
          <div className="glass-panel p-5 flex flex-col gap-3 min-h-[220px]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-accent-cyan" />
                <h3 className="font-display text-[10px] font-bold tracking-wider text-text-primary uppercase">
                  RAW PIPELINE LOG STREAM
                </h3>
              </div>
            </div>

            <div className="flex-1 bg-black/40 border border-white/5 rounded-lg p-3 font-mono text-[9px] text-text-secondary flex flex-col gap-1.5 leading-relaxed min-h-[140px] max-h-[220px] overflow-y-auto scrollbar-thin select-text">
              {logs.length === 0 ? (
                <div className="text-text-muted animate-pulse select-none">
                  Awaiting log gateway stream data...
                </div>
              ) : (
                logs.map((log, idx) => {
                  const time = log.timestamp ? log.timestamp.split('T')[1]?.slice(0, 8) || log.timestamp : '';
                  const level = (log.level || 'info').toUpperCase();
                  const isError = level === 'ERROR';
                  const isWarn = level === 'WARNING' || level === 'WARN';
                  const isSuccess = log.event?.toLowerCase().includes('success') || 
                                    log.event?.toLowerCase().includes('established') || 
                                    log.event?.toLowerCase().includes('connected');
                  
                  let levelColor = 'text-text-secondary';
                  if (isError) levelColor = 'text-accent-red font-bold';
                  else if (isWarn) levelColor = 'text-amber-400 font-bold';
                  else if (isSuccess) levelColor = 'text-accent-green';

                  return (
                    <div key={idx} className="flex gap-2 hover:bg-white/3 py-0.5 rounded px-1 transition-all">
                      <span className="text-text-muted flex-shrink-0 select-none">{time}</span>
                      <span className={`flex-shrink-0 uppercase select-none ${levelColor}`}>[{level}]</span>
                      {log.correlation_id && (
                        <span className="text-accent-violet flex-shrink-0 select-none">({log.correlation_id})</span>
                      )}
                      <span className="text-text-primary flex-1 break-all select-text">
                        {log.event}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
        
      </div>
    </div>
  );
}
