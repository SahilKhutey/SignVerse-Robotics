'use client';

/**
 * AnatomySourceCard
 * =================
 * Displays the human anatomical joint angles that were the input to the
 * retargeting pipeline (right_shoulder_abduction, right_elbow_flexion,
 * right_shoulder_roll, etc.) as labelled horizontal bars.
 */

import { useSignVerseStore } from '../state/signverse-store';

// Display config: key → { label, range in radians, colour }
const ANATOMY_CONFIG: Record<string, { label: string; min: number; max: number; color: string }> = {
  right_shoulder_abduction: { label: 'R. Shoulder Abduction', min: 0,          max: Math.PI,      color: 'var(--joint-j0)' },
  right_elbow_flexion:      { label: 'R. Elbow Flexion',      min: 0,          max: Math.PI,      color: 'var(--joint-j2)' },
  right_shoulder_roll:      { label: 'R. Shoulder Roll',       min: -Math.PI/2, max: Math.PI/2,    color: 'var(--joint-j1)' },
  left_shoulder_abduction:  { label: 'L. Shoulder Abduction',  min: 0,          max: Math.PI,      color: '#10b981' },
  left_elbow_flexion:       { label: 'L. Elbow Flexion',       min: 0,          max: Math.PI,      color: '#14b8a6' },
  right_hip_abduction:      { label: 'R. Hip Abduction',       min: 0,          max: Math.PI,      color: '#f97316' },
  right_knee_flexion:       { label: 'R. Knee Flexion',        min: 0,          max: Math.PI,      color: '#fb923c' },
};

function rad2deg(r: number) { return Math.round(r * 180 / Math.PI); }

interface AngleRowProps {
  keyName: string;
  value:   number;
}

function AngleRow({ keyName, value }: AngleRowProps) {
  const cfg = ANATOMY_CONFIG[keyName];
  if (!cfg) return null;

  const { label, min, max, color } = cfg;
  const range  = max - min;
  const pct    = range > 0 ? ((value - min) / range) * 100 : 50;
  const safePct = Math.max(0, Math.min(100, pct));
  const isNeg  = value < 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{label}</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          color,
        }}>
          {isNeg ? '' : ''}{rad2deg(value)}°
        </span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${safePct}%`,
            background: color,
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}

export default function AnatomySourceCard() {
  const frame = useSignVerseStore(s => s.frame);
  const angles = frame?.retargeting?.source_angles ?? {};
  const smoothed = frame?.retargeting?.smoothed ?? false;
  const hasData = Object.keys(angles).length > 0;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="label">Anatomical Source Angles</span>
        <div className="flex gap-2 items-center">
          {smoothed && (
            <span className="badge badge-info" style={{ fontSize: 9 }}>Kalman</span>
          )}
          <span className="badge badge-ok" style={{ fontSize: 9, opacity: hasData ? 1 : 0.4 }}>
            {hasData ? 'Active' : 'No Data'}
          </span>
        </div>
      </div>

      {hasData ? (
        <div className="flex flex-col gap-2">
          {Object.keys(ANATOMY_CONFIG).map(key => {
            const val = angles[key];
            if (val === undefined) return null;
            return <AngleRow key={key} keyName={key} value={val} />;
          })}
        </div>
      ) : (
        <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
          Waiting for MediaPipe landmarks…
        </div>
      )}
    </div>
  );
}
