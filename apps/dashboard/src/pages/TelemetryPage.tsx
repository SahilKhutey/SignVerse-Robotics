import React, { useState, useEffect } from 'react';
import { useTelemetryStore } from '../store/telemetry';
import { Activity, Brain, Clock, Download, Layers } from 'lucide-react';
import MetricCard from '../components/telemetry/MetricCard';
import FrameRateDisplay from '../components/telemetry/FrameRateDisplay';
import JointAngleChart from '../components/telemetry/JointAngleChart';
import VelocityChart from '../components/telemetry/VelocityChart';
import ConfidenceGauge from '../components/telemetry/ConfidenceGauge';
import AnalyticsDashboard from '../components/telemetry/AnalyticsDashboard';
import { telemetryRingBuffer } from '../lib/RingBuffer';
import { calculateVelocities } from '../lib/telemetryDerived';

export default function TelemetryPage() {
  const wsState = useTelemetryStore((state) => state.wsState);
  const frame = useTelemetryStore((state) => state.frame);
  const confidence = frame?.confidence ?? 0.0;

  // ── Metrics calculations ──────────────────────────────────────────────────
  const [totalFrames, setTotalFrames] = useState(0);
  const [duration, setDuration] = useState(0);

  // Accumulate frames
  useEffect(() => {
    if (wsState === 'LIVE' && frame) {
      setTotalFrames((prev) => prev + 1);
    } else if (wsState !== 'LIVE') {
      setTotalFrames(0);
    }
  }, [frame, wsState]);

  // Monitor session duration
  useEffect(() => {
    if (wsState !== 'LIVE') {
      setDuration(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setDuration(Math.round((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [wsState]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── CSV Exporter ──────────────────────────────────────────────────────────
  const handleExport = () => {
    const snapshot = telemetryRingBuffer.getSnapshot();
    if (snapshot.length === 0) {
      alert('No telemetry data available in RingBuffer to export.');
      return;
    }

    const headers = 'TimestampMs,J0,J1,J2,J3,J4,J5,J6,V0,V1,V2,V3,V4,V5,V6,Confidence\n';
    
    const rows = snapshot.map((f, idx) => {
      const prev = idx > 0 ? snapshot[idx - 1] : null;
      const vels = calculateVelocities(f, prev);
      const angles = f.jointAngles || [];
      
      const angleString = angles.map(a => a.toFixed(4)).join(',');
      const velString = vels.map(v => v.toFixed(4)).join(',');
      
      return `${f.timestampMs},${angleString},${velString},${f.confidence.toFixed(4)}`;
    }).join('\n');

    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `telemetry_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6 bg-[#07080a]">
      {/* Page Header */}
      <div className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-accent-cyan" />
            <h2 className="font-display text-sm font-bold tracking-wider text-text-primary uppercase">
              Telemetry Diagnostics
            </h2>
          </div>
          <p className="text-[10px] text-text-secondary">
            Real-time manipulator joint telemetry monitoring, safety envelope auditing, and actuator torque loads.
          </p>
        </div>

        {/* CSV Exporter Button */}
        <button
          id="export-csv-btn"
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/10 hover:bg-accent-cyan/20 border border-accent-cyan/30 hover:border-accent-cyan/50 text-accent-cyan font-mono text-[9px] font-bold tracking-wider uppercase transition-all shadow-[0_0_12px_rgba(0,240,255,0.1)] cursor-pointer"
        >
          <Download size={12} />
          Export Telemetry CSV
        </button>
      </div>

      {/* Top row: 4 metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="telemetry-metrics-grid">
        {!frame ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} data-testid="skeleton" className="animate-pulse bg-white/5 border border-white/5 rounded-xl h-24 w-full" />
          ))
        ) : (
          <>
            <FrameRateDisplay />
            
            <MetricCard
              id="metric-confidence"
              title="AI POLICY CONFIDENCE"
              value={`${Math.round(confidence * 100)}%`}
              icon={<Brain size={14} className={confidence >= 0.8 ? 'text-accent-green' : 'text-accent-cyan'} />}
              description={confidence >= 0.8 ? 'Optimal prediction alignment' : 'Low matching density'}
            />

            <MetricCard
              id="metric-session-duration"
              title="ACTIVE SESSION RUNTIME"
              value={formatDuration(duration)}
              icon={<Clock size={14} className="text-accent-violet" />}
              description={wsState === 'LIVE' ? 'Stream active' : 'Stream disconnected'}
            />

            <MetricCard
              id="metric-frame-count"
              title="ACCUMULATED FRAMES"
              value={totalFrames}
              icon={<Layers size={14} className="text-accent-cyan" />}
              description="Total telemetry frames counted"
            />
          </>
        )}
      </div>

      {/* Main Charts Area */}
      <div className="flex flex-col gap-6">
        
        {/* Full-width 7-DOF Joint State Chart */}
        <div className="w-full">
          <JointAngleChart />
        </div>

        {/* Bottom row: Velocity Chart & Confidence Gauge side by side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <VelocityChart />
          <ConfidenceGauge />
        </div>

        {/* Multi-Session Comparison Dashboard */}
        <div className="w-full mt-2">
          <AnalyticsDashboard />
        </div>

      </div>
    </div>
  );
}
