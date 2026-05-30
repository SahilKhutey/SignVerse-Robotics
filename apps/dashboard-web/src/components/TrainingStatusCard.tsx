'use client';

/**
 * TrainingStatusCard
 * ===================
 * Shows live BC training stats polled from /api/training/status every 3s
 * (already handled by the Zustand store poller).
 */

import { useSignVerseStore } from '../state/signverse-store';

function StatRow({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1"
         style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
      <span style={{
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: 11, fontWeight: 600, color: '#94a3b8',
      }}>
        {value}
      </span>
    </div>
  );
}

export default function TrainingStatusCard() {
  const raw = useSignVerseStore(s => s.trainingStats) as Record<string, unknown> | null;

  const isTraining     = raw?.['is_training']       === true;
  const totalRuns      = (raw?.['total_train_runs'] as number) ?? 0;
  const hasNew         = raw?.['new_weights_ready'] === true;
  const trainLoss      = (raw?.['ema_train_loss']   as number) ?? null;
  const valLoss        = (raw?.['ema_val_loss']      as number) ?? null;
  const ckpt           = raw?.['best_checkpoint']    as string | null;
  const recStats       = raw?.['recorder']           as Record<string, number> | null;

  const statusColor = isTraining ? 'var(--mode-ai)'
                    : hasNew     ? 'var(--status-ok)'
                    : totalRuns > 0 ? 'var(--status-info)'
                    : 'var(--status-idle)';

  const statusLabel = isTraining ? 'Training…'
                    : hasNew     ? 'New Weights Ready'
                    : totalRuns > 0 ? 'Idle'
                    : 'Waiting for Data';

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="label">Online BC Training</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: statusColor,
          ...(isTraining ? { animation: 'pulse-glow 1.5s ease-in-out infinite' } : {}),
        }}>
          {statusLabel}
        </span>
      </div>

      {raw ? (
        <div className="flex flex-col gap-0">
          <StatRow label="Training Runs"   value={totalRuns}  mono />
          {trainLoss !== null && (
            <StatRow label="Train Loss (EMA)" value={trainLoss.toFixed(5)} mono />
          )}
          {valLoss !== null && (
            <StatRow label="Val Loss (EMA)"   value={valLoss.toFixed(5)}   mono />
          )}
          {recStats && (
            <>
              <StatRow label="Frames Recorded" value={(recStats['total_frames'] ?? 0).toLocaleString()} mono />
              <StatRow label="Frames Dropped"  value={recStats['dropped_frames'] ?? 0} mono />
            </>
          )}
          {ckpt && (
            <div className="flex items-center justify-between py-1">
              <span style={{ fontSize: 11, color: '#64748b' }}>Checkpoint</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: '#475569', maxWidth: 140, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={ckpt}>
                {ckpt.split(/[\\/]/).pop()}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: '#1e293b', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
          Connecting to gateway…
        </div>
      )}
    </div>
  );
}
