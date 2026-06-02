'use client';

/**
 * SignVerse OS — Control Center Dashboard (Phase 17)
 * ====================================================
 * Updated grid: adds TrainingStatusCard in the right column row 3.
 */

import { useEffect } from 'react';
import { startWebSocket, stopWebSocket } from '../state/signverse-store';

import SystemMetricsBar    from '../components/SystemMetricsBar';
import ModeIndicator       from '../components/ModeIndicator';
import JointGaugePanel     from '../components/JointGaugePanel';
import AnatomySourceCard   from '../components/AnatomySourceCard';
import ViolationAlertFeed  from '../components/ViolationAlertFeed';
import TelemetryLogFeed    from '../components/TelemetryLogFeed';
import TrainingStatusCard  from '../components/TrainingStatusCard';
import PipelineStatusCard  from '../components/PipelineStatusCard';
import IngestionLauncherCard from '../components/IngestionLauncherCard';

export default function DashboardPage() {
  useEffect(() => {
    startWebSocket();
    return () => stopWebSocket();
  }, []);

  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: '300px 1fr 320px',
      gridTemplateRows:    'auto auto auto auto auto',
      gap:                 12,
      minHeight:           '100vh',
      padding:             12,
      background: [
        'radial-gradient(ellipse at 15% 0%,   rgba(59,130,246,0.09) 0%, transparent 50%)',
        'radial-gradient(ellipse at 85% 100%, rgba(99,102,241,0.07) 0%, transparent 50%)',
        'var(--bg-base)',
      ].join(', '),
    }}>

      {/* ── Row 1: Header bar ──────────────────────────────────────────── */}
      <div style={{ gridColumn: '1 / -1' }}>
        <SystemMetricsBar />
      </div>

      {/* ── Row 2 ────────────────────────────────────────────────────── */}
      <ModeIndicator />
      <JointGaugePanel />
      <AnatomySourceCard />

      {/* ── Row 3 ────────────────────────────────────────────────────── */}
      {/* Col 1–2: Telemetry log */}
      <div style={{ gridColumn: '1 / 3' }}>
        <TelemetryLogFeed />
      </div>

      {/* Col 3: Violation feed */}
      <ViolationAlertFeed />

      {/* ── Row 4 ────────────────────────────────────────────────────── */}
      {/* Col 1–2: Training status */}
      <div style={{ gridColumn: '1 / 3' }}>
        <TrainingStatusCard />
      </div>

      {/* Col 3: pipeline lifecycle */}
      <PipelineStatusCard />

      {/* Row 5: ingestion launcher */}
      <div style={{ gridColumn: '1 / 3' }}>
        <IngestionLauncherCard />
      </div>

      {/* ── Footer strip ──────────────────────────────────────────────── */}
      <div
        style={{
          gridColumn:     '1 / -1',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '8px 16px',
          background:     'var(--bg-surface)',
          borderRadius:   'var(--radius-md)',
          border:         '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: 10, color: '#334155', fontFamily: 'var(--font-mono)' }}>
          SignVerse OS · Phase 17 · Sync Fixed
        </span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <FooterStat label="Pipeline" value="Perception → Retargeting → IK → Hardware" />
          <FooterStat label="Training" value="Live BC · EpisodeRecorder · Orchestrator" />
          <FooterStat label="WS"       value="ws://localhost:8000/ws/telemetry" />
        </div>
      </div>
    </div>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 9, color: '#1e293b', fontFamily: 'var(--font-mono)' }}>
      <span style={{ color: '#334155' }}>{label}: </span>{value}
    </span>
  );
}
