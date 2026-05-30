'use client';

/**
 * TelemetryLogFeed
 * ================
 * Rolling log of the last N telemetry frames, showing timestamp,
 * mode, joint angles, and violation flag for each frame.
 */

import { useSignVerseStore, LogEntry, InferenceMode } from '../state/signverse-store';

const MODE_SHORT: Record<InferenceMode | string, string> = {
  ai_inference:       'AI',
  retargeted:         'RT',
  math_fallback:      'MF',
  cognitive_override: 'CO',
  SHUTDOWN:           'SH',
  ERROR:              'ER',
  CONNECTING:         '--',
  DISCONNECTED:       '--',
};

const MODE_COLOR: Record<string, string> = {
  ai_inference:       'var(--mode-ai)',
  retargeted:         'var(--mode-retargeted)',
  math_fallback:      'var(--mode-math)',
  cognitive_override: 'var(--mode-cognitive)',
};

function rad2deg(r: number) {
  return Math.round(r * 180 / Math.PI);
}

function LogRow({ entry, fresh }: { entry: LogEntry; fresh: boolean }) {
  const t   = new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false });
  const ms  = String(new Date(entry.ts).getMilliseconds()).padStart(3, '0');
  const col = MODE_COLOR[entry.mode] ?? 'var(--status-idle)';
  const q   = entry.q_target;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 rounded"
      style={{
        background: fresh ? 'rgba(59,130,246,0.05)' : 'transparent',
        borderLeft: `2px solid ${fresh ? col : 'transparent'}`,
        transition: 'background 0.3s',
      }}
    >
      {/* Timestamp */}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#334155', minWidth: 62 }}>
        {t}.{ms}
      </span>

      {/* Mode tag */}
      <span style={{
        fontFamily:  'var(--font-mono)',
        fontSize:     9,
        fontWeight:  700,
        color:       col,
        minWidth:    18,
      }}>
        {MODE_SHORT[entry.mode] ?? '??'}
      </span>

      {/* Joint angles */}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', flex: 1 }}>
        {q.map((v, i) => `J${i}:${rad2deg(v)}°`).join('  ')}
      </span>

      {/* Violation dot */}
      {entry.violation && (
        <span className="dot dot-error" style={{ width: 5, height: 5 }} />
      )}
    </div>
  );
}

export default function TelemetryLogFeed() {
  const log = useSignVerseStore(s => s.log);

  return (
    <div className="card p-4 flex flex-col gap-3" style={{ minHeight: 160 }}>
      <div className="flex items-center justify-between">
        <span className="label">Telemetry Log</span>
        <span className="value-sm">{log.length} frames</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3" style={{ opacity: 0.5 }}>
        <span className="label" style={{ minWidth: 62 }}>Timestamp</span>
        <span className="label" style={{ minWidth: 18 }}>Mode</span>
        <span className="label" style={{ flex: 1 }}>Joint Angles</span>
        <span className="label">V</span>
      </div>

      <div className="header-glow-line" />

      {/* Log rows */}
      <div
        className="flex flex-col gap-0.5 overflow-y-auto"
        style={{ maxHeight: 220 }}
      >
        {log.length === 0 ? (
          <div style={{ color: '#1e293b', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>
            No frames received
          </div>
        ) : (
          log.map((entry, i) => (
            <LogRow key={entry.id} entry={entry} fresh={i === 0} />
          ))
        )}
      </div>
    </div>
  );
}
