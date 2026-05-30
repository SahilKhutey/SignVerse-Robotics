'use client';

/**
 * ModeIndicator
 * =============
 * Animated pill showing the current inference mode with colour coding,
 * icon, and a brief description of what that mode means.
 */

import { useSignVerseStore, InferenceMode } from '../state/signverse-store';

interface ModeConfig {
  label:       string;
  description: string;
  color:       string;
  bg:          string;
  border:      string;
  pulse:       boolean;
  icon:        string;
}

const MODE_CONFIG: Record<InferenceMode, ModeConfig> = {
  ai_inference: {
    label:       'AI Inference',
    description: 'Behavior Cloning MLP — neural policy active',
    color:       'var(--mode-ai)',
    bg:          'rgba(168,85,247,0.12)',
    border:      'rgba(168,85,247,0.35)',
    pulse:       true,
    icon:        '◈',
  },
  retargeted: {
    label:       'Retargeted',
    description: 'Kalman → Skeleton → Constraint pipeline',
    color:       'var(--mode-retargeted)',
    bg:          'rgba(34,197,94,0.1)',
    border:      'rgba(34,197,94,0.3)',
    pulse:       false,
    icon:        '⟳',
  },
  math_fallback: {
    label:       'Math Fallback',
    description: 'Damped Least-Squares IK — no landmarks',
    color:       'var(--mode-math)',
    bg:          'rgba(245,158,11,0.1)',
    border:      'rgba(245,158,11,0.3)',
    pulse:       false,
    icon:        '∑',
  },
  cognitive_override: {
    label:       'Cognitive Override',
    description: 'LLM semantic command injected',
    color:       'var(--mode-cognitive)',
    bg:          'rgba(249,115,22,0.12)',
    border:      'rgba(249,115,22,0.35)',
    pulse:       true,
    icon:        '⚡',
  },
  SHUTDOWN: {
    label:       'Shutdown',
    description: 'Kernel halted',
    color:       'var(--mode-shutdown)',
    bg:          'rgba(100,116,139,0.1)',
    border:      'rgba(100,116,139,0.2)',
    pulse:       false,
    icon:        '■',
  },
  ERROR: {
    label:       'Error',
    description: 'Kernel error — check logs',
    color:       'var(--status-error)',
    bg:          'rgba(239,68,68,0.1)',
    border:      'rgba(239,68,68,0.3)',
    pulse:       true,
    icon:        '✕',
  },
  CONNECTING: {
    label:       'Connecting',
    description: 'Establishing gateway connection…',
    color:       'var(--status-info)',
    bg:          'rgba(56,189,248,0.08)',
    border:      'rgba(56,189,248,0.2)',
    pulse:       true,
    icon:        '◌',
  },
  DISCONNECTED: {
    label:       'Disconnected',
    description: 'No gateway connection',
    color:       'var(--status-idle)',
    bg:          'rgba(100,116,139,0.08)',
    border:      'rgba(100,116,139,0.15)',
    pulse:       false,
    icon:        '○',
  },
};

export default function ModeIndicator() {
  const frame    = useSignVerseStore(s => s.frame);
  const wsStatus = useSignVerseStore(s => s.wsStatus);

  let mode: InferenceMode;
  if (wsStatus === 'connecting')   mode = 'CONNECTING';
  else if (wsStatus !== 'connected' || !frame) mode = 'DISCONNECTED';
  else mode = frame.mode ?? 'DISCONNECTED';

  const cfg = MODE_CONFIG[mode] ?? MODE_CONFIG['DISCONNECTED'];

  return (
    <div
      className="card p-5 flex flex-col gap-4"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      <span className="label">Inference Mode</span>

      {/* Main mode pill */}
      <div className="flex items-center gap-3">
        <span
          style={{
            fontSize: '1.5rem',
            color: cfg.color,
            ...(cfg.pulse ? { animation: 'pulse-glow 1.5s ease-in-out infinite' } : {}),
          }}
        >
          {cfg.icon}
        </span>
        <div>
          <div style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: cfg.color,
            lineHeight: 1.2,
          }}>
            {cfg.label}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {cfg.description}
          </div>
        </div>
      </div>

      {/* Mode history mini-bar */}
      <ModeHistory />
    </div>
  );
}

function ModeHistory() {
  const log = useSignVerseStore(s => s.log);
  const recent = log.slice(0, 30).reverse();

  const modeColor: Record<string, string> = {
    ai_inference:       'var(--mode-ai)',
    retargeted:         'var(--mode-retargeted)',
    math_fallback:      'var(--mode-math)',
    cognitive_override: 'var(--mode-cognitive)',
  };

  if (recent.length === 0) return null;

  return (
    <div>
      <span className="label" style={{ marginBottom: 4, display: 'block' }}>
        Mode History (last 30 frames)
      </span>
      <div className="flex gap-0.5 items-end" style={{ height: 20 }}>
        {recent.map((entry) => (
          <div
            key={entry.id}
            className="flex-1 rounded-sm"
            style={{
              height: entry.violation ? 20 : 12,
              background: modeColor[entry.mode] ?? 'var(--status-idle)',
              opacity: 0.7,
              transition: 'height 0.1s ease',
            }}
            title={entry.mode}
          />
        ))}
      </div>
    </div>
  );
}
