'use client';

/**
 * SystemMetricsBar (Phase 17 — Fixed)
 * =====================================
 * Fixes:
 *   ✓ Wall clock ticks every second via useEffect setInterval
 *   ✓ Stale stream banner when no frame received for >5s while connected
 *   ✓ Training status dot from REST polling
 */

import { useEffect, useState } from 'react';
import { useSignVerseStore, selectIsStale } from '../state/signverse-store';

function MetricChip({
  label, value, unit = '', accent = false, warn = false, danger = false,
}: {
  label:   string;
  value:   string | number;
  unit?:   string;
  accent?: boolean;
  warn?:   boolean;
  danger?: boolean;
}) {
  const color = danger ? 'var(--status-error)'
              : warn   ? 'var(--status-warn)'
              : accent ? 'var(--accent-primary)'
              : '#94a3b8';
  return (
    <div className="flex flex-col items-center gap-0.5 px-4"
         style={{ borderRight: '1px solid var(--border-subtle)' }}>
      <span className="label">{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color }}>
        {value}<span style={{ fontSize: 10, fontWeight: 400, color: '#475569' }}>{unit}</span>
      </span>
    </div>
  );
}

function WsStatusBadge() {
  const wsStatus    = useSignVerseStore(s => s.wsStatus);
  const wsLatencyMs = useSignVerseStore(s => s.wsLatencyMs);
  const isStale     = useSignVerseStore(selectIsStale);

  const map: Record<string, { dot: string; label: string }> = {
    connected:    { dot: 'dot-ok',    label: isStale ? 'Stale'    : 'Connected'  },
    connecting:   { dot: 'dot-warn',  label: 'Connecting…' },
    disconnected: { dot: 'dot-idle',  label: 'Offline'     },
    error:        { dot: 'dot-error', label: 'Error'       },
  };

  const s = map[wsStatus] ?? map['disconnected'];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`dot ${isStale ? 'dot-warn' : s.dot} ${
          wsStatus === 'connected' && !isStale ? 'anim-pulse-glow' : ''
        }`}
      />
      <span style={{ fontSize: 11, color: isStale ? 'var(--status-warn)' : '#64748b', fontWeight: 500 }}>
        {s.label}
      </span>
      {wsStatus === 'connected' && wsLatencyMs > 0 && (
        <span className="value-sm">{wsLatencyMs}ms RTT</span>
      )}
    </div>
  );
}

function TrainingDot() {
  const stats = useSignVerseStore(s => s.trainingStats) as Record<string, unknown> | null;
  if (!stats) return null;
  const isTraining = stats['is_training'] === true;
  const hasWeights = stats['new_weights_ready'] === true;

  if (hasWeights) return (
    <span className="badge badge-ok" style={{ fontSize: 9 }}>New Weights</span>
  );
  if (isTraining) return (
    <span className="badge badge-info anim-pulse-glow" style={{ fontSize: 9 }}>Training…</span>
  );
  return null;
}

export default function SystemMetricsBar() {
  const frame      = useSignVerseStore(s => s.frame);
  const frameCount = useSignVerseStore(s => s.frameCount);
  const isStale    = useSignVerseStore(selectIsStale);

  const fps      = frame?.fps ?? 0;
  const vram     = frame?.gpu_vram_mb ?? 0;
  const vramWarn = vram > 1400;
  const fpsDanger = fps > 0 && fps < 30;

  // Fix #9: live wall clock
  const [now, setNow] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour12: false })
  );

  useEffect(() => {
    const id = setInterval(
      () => setNow(new Date().toLocaleTimeString('en-US', { hour12: false })),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Stale stream banner */}
      {isStale && (
        <div style={{
          background: 'rgba(245,158,11,0.12)',
          border:     '1px solid rgba(245,158,11,0.35)',
          borderRadius: 'var(--radius-md)',
          padding:    '4px 16px',
          fontSize:   10,
          color:      'var(--status-warn)',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textAlign: 'center',
          marginBottom: 4,
        }}>
          ⚠ STREAM STALE — No telemetry received in &gt;5s
        </div>
      )}

      <div
        className="glass flex items-center justify-between px-5"
        style={{ height: 64, borderRadius: 'var(--radius-lg)' }}
      >
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
            boxShadow: 'var(--shadow-glow-sm)',
          }}>SV</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>
              SignVerse OS
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>Control Center v1.1</div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex items-center">
          <MetricChip label="Frames"   value={frameCount.toLocaleString()} />
          <MetricChip label="FPS"      value={fps}  unit=" hz"
                      accent={fps >= 55} danger={fpsDanger} />
          <MetricChip label="Memory"   value={vram} unit=" MB" warn={vramWarn} />
          <MetricChip label="Time"     value={now}  />
          <div className="px-4 flex items-center">
            <TrainingDot />
          </div>
        </div>

        {/* WS status */}
        <WsStatusBadge />
      </div>
    </div>
  );
}
