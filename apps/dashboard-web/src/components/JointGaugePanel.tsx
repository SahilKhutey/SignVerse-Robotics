'use client';

/**
 * JointGaugePanel
 * ===============
 * Displays three SVG arc gauges for robot joints J0, J1, J2.
 * Each arc fills proportionally to the joint's position within its limits.
 */

import { useSignVerseStore, JOINT_LIMITS, JOINT_LABELS } from '../state/signverse-store';

const JOINT_COLORS: Record<string, string> = {
  J0: 'var(--joint-j0)',
  J1: 'var(--joint-j1)',
  J2: 'var(--joint-j2)',
};

interface ArcGaugeProps {
  id:     string;
  value:  number;   // radians
  min:    number;
  max:    number;
  color:  string;
  label:  string;
  size?:  number;
}

function ArcGauge({ id, value, min, max, color, label, size = 96 }: ArcGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = (size / 2) - 10;

  // Arc spans 240° (from -210° to 30° in standard coords, i.e., bottom-left to bottom-right)
  const startAngle = 210;   // degrees from positive X axis, going clockwise
  const arcSpan   = 240;

  const clampedVal = Math.max(min, Math.min(max, value));
  const pct        = max !== min ? (clampedVal - min) / (max - min) : 0;
  const fillDeg    = pct * arcSpan;

  function polarToXY(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function describeArc(startDeg: number, endDeg: number, radius: number) {
    const s   = polarToXY(startDeg, radius);
    const e   = polarToXY(endDeg, radius);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const trackStart  = startAngle;
  const trackEnd    = startAngle + arcSpan;
  const fillEnd     = startAngle + fillDeg;

  const degVal = Math.round((value * 180) / Math.PI);
  const minDeg = Math.round((min * 180) / Math.PI);
  const maxDeg = Math.round((max * 180) / Math.PI);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <path
            d={describeArc(trackStart, trackEnd, r)}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={8}
            strokeLinecap="round"
          />
          {/* Fill */}
          {fillDeg > 1 && (
            <path
              d={describeArc(trackStart, fillEnd, r)}
              fill="none"
              stroke={color}
              strokeWidth={8}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 6px ${color})`,
                transition: 'all 0.15s ease',
              }}
            />
          )}
          {/* Tick marks at limits */}
          <circle cx={polarToXY(trackStart, r).x} cy={polarToXY(trackStart, r).y} r={2}
            fill="rgba(255,255,255,0.25)" />
          <circle cx={polarToXY(trackEnd, r).x} cy={polarToXY(trackEnd, r).y} r={2}
            fill="rgba(255,255,255,0.25)" />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center"
             style={{ paddingTop: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: size > 80 ? '1.1rem' : '0.85rem',
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}>
            {degVal}°
          </span>
          <span className="label" style={{ fontSize: 9, marginTop: 2 }}>{id}</span>
        </div>
      </div>
      {/* Label + range */}
      <div className="text-center">
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{label}</div>
        <div className="value-sm" style={{ color: '#475569', fontSize: 10 }}>
          {minDeg}° – {maxDeg}°
        </div>
      </div>
    </div>
  );
}

export default function JointGaugePanel() {
  const frame = useSignVerseStore(s => s.frame);

  const q = frame?.q_target ?? [0, 0, 0];
  const joints = ['J0', 'J1', 'J2'];

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="label">Joint Angles</span>
        <span className="badge badge-ok" style={{ fontSize: 9 }}>LIVE</span>
      </div>

      <div className="flex justify-around items-start">
        {joints.map((j, i) => {
          const [min, max] = JOINT_LIMITS[j];
          return (
            <ArcGauge
              key={j}
              id={j}
              value={q[i] ?? 0}
              min={min}
              max={max}
              color={JOINT_COLORS[j]}
              label={JOINT_LABELS[j]}
              size={100}
            />
          );
        })}
      </div>

      {/* Linear bars beneath */}
      <div className="flex flex-col gap-2">
        {joints.map((j, i) => {
          const [min, max] = JOINT_LIMITS[j];
          const pct = max !== min ? ((q[i] ?? 0) - min) / (max - min) * 100 : 0;
          const safePct = Math.max(0, Math.min(100, pct));
          return (
            <div key={j} className="flex items-center gap-3">
              <span className="label w-6">{j}</span>
              <div className="progress-track flex-1">
                <div
                  className="progress-fill"
                  style={{
                    width: `${safePct}%`,
                    background: JOINT_COLORS[j],
                    boxShadow: `0 0 6px ${JOINT_COLORS[j]}`,
                  }}
                />
              </div>
              <span className="value-sm w-10 text-right">
                {Math.round(((q[i] ?? 0) * 180) / Math.PI)}°
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
