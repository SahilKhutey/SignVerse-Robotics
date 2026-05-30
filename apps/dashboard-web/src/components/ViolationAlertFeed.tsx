'use client';

/**
 * ViolationAlertFeed
 * ===================
 * Scrollable, auto-expiring list of joint constraint violations.
 * Hard violations glow red; soft violations amber.
 * Each entry shows: joint name, severity badge, limit direction, angle delta.
 */

import { useSignVerseStore, ViolationRecord } from '../state/signverse-store';

function rad2deg(r: number) { return Math.round(r * 180 / Math.PI * 10) / 10; }

function ViolationRow({ v, idx }: { v: ViolationRecord; idx: number }) {
  const isHard = v.severity === 'hard';
  const delta  = rad2deg(Math.abs(v.requested - v.clamped));

  return (
    <div
      className="anim-slide-in flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{
        animationDelay: `${idx * 20}ms`,
        background: isHard
          ? 'rgba(239,68,68,0.07)'
          : 'rgba(245,158,11,0.07)',
        borderLeft: `2px solid ${isHard ? 'var(--status-error)' : 'var(--status-warn)'}`,
      }}
    >
      {/* Joint pill */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        color: isHard ? 'var(--status-error)' : 'var(--status-warn)',
        minWidth: 20,
      }}>
        {v.joint}
      </span>

      {/* Severity badge */}
      <span className={`badge ${isHard ? 'badge-hard' : 'badge-soft'}`} style={{ flexShrink: 0 }}>
        {v.severity}
      </span>

      {/* Direction */}
      <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0 }}>
        {v.limit_hit === 'upper' ? '↑ over' : '↓ under'}
      </span>

      {/* Delta */}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', marginLeft: 'auto', flexShrink: 0 }}>
        +{delta}°
      </span>
    </div>
  );
}

export default function ViolationAlertFeed() {
  const violations = useSignVerseStore(s => s.violations);
  const frame      = useSignVerseStore(s => s.frame);
  const liveVs     = frame?.retargeting?.violations ?? [];
  const hardCount  = violations.filter(v => v.severity === 'hard').length;
  const softCount  = violations.filter(v => v.severity === 'soft').length;

  return (
    <div className="card p-4 flex flex-col gap-3" style={{ minHeight: 200 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="label">Constraint Violations</span>
        <div className="flex gap-2">
          {hardCount > 0 && (
            <span className="badge badge-hard">{hardCount} hard</span>
          )}
          {softCount > 0 && (
            <span className="badge badge-soft">{softCount} soft</span>
          )}
          {hardCount === 0 && softCount === 0 && (
            <span className="badge badge-ok">Clean</span>
          )}
        </div>
      </div>

      {/* Live violations this frame */}
      {liveVs.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="label" style={{ color: 'var(--status-warn)' }}>This Frame</span>
          {liveVs.map((v, i) => (
            <ViolationRow key={`live-${i}`} v={v} idx={i} />
          ))}
        </div>
      )}

      {/* Historical log */}
      <div
        className="flex flex-col gap-1 overflow-y-auto"
        style={{ maxHeight: 180, flex: 1 }}
      >
        {violations.length === 0 && liveVs.length === 0 ? (
          <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>
            No violations recorded
          </div>
        ) : (
          violations.slice(0, 20).map((v, i) => (
            <ViolationRow key={v.ts ?? i} v={v} idx={i} />
          ))
        )}
      </div>
    </div>
  );
}
