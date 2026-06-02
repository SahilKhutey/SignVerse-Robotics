'use client';

import type { PipelineJobSnapshot, PipelineStatus } from 'api-contracts';
import { useSignVerseStore } from '../state/signverse-store';

const STATUS_STYLE: Record<PipelineStatus, { label: string; color: string; badge: string; pulse?: boolean }> = {
  queued: {
    label: 'Queued',
    color: 'var(--status-idle)',
    badge: 'badge-info',
  },
  processing: {
    label: 'Processing',
    color: 'var(--status-info)',
    badge: 'badge-info',
    pulse: true,
  },
  completed: {
    label: 'Complete',
    color: 'var(--status-ok)',
    badge: 'badge-ok',
  },
  failed: {
    label: 'Failed',
    color: 'var(--status-error)',
    badge: 'badge-hard',
  },
  retrying: {
    label: 'Retrying',
    color: 'var(--status-warn)',
    badge: 'badge-soft',
    pulse: true,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--status-idle)',
    badge: 'badge',
  },
};

const STAGE_LABELS: Record<string, string> = {
  ingestion: 'Ingest',
  perception: 'Vision',
  fusion: 'Fusion',
  kinematics: 'IK',
  simulation: 'Sim',
  export: 'Export',
};

function getDisplayValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function getJobSource(job: PipelineJobSnapshot): string {
  return getDisplayValue(job.metadata['source_type'])?.replace(/_/g, ' ') ?? 'manual';
}

function getJobTarget(job: PipelineJobSnapshot): string {
  const raw =
    getDisplayValue(job.metadata['filename']) ??
    getDisplayValue(job.metadata['url']) ??
    getDisplayValue(job.metadata['path']) ??
    job.job_id;

  try {
    if (raw.startsWith('http')) return new URL(raw).hostname;
  } catch {
    return raw;
  }

  return raw.split(/[\\/]/).pop() ?? raw;
}

function getProgressPercent(job: PipelineJobSnapshot): number {
  if (job.status === 'completed') return 100;
  const activeWeight = job.status === 'processing' ? 0.5 : job.status === 'retrying' ? 0.35 : 0;
  const progress = (job.current_stage_index + activeWeight) / job.stages.length;
  return Math.round(Math.max(0, Math.min(1, progress)) * 100);
}

function getRelativeTime(timestamp: string): string {
  const elapsedMs = Date.now() - Date.parse(timestamp);
  if (!Number.isFinite(elapsedMs)) return 'unknown';
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function StageStrip({ job }: { job: PipelineJobSnapshot }) {
  return (
    <div className="flex items-center gap-1">
      {job.stages.map((stage, index) => {
        const isComplete = job.status === 'completed' || index < job.current_stage_index;
        const isCurrent = job.status !== 'completed' && index === job.current_stage_index;
        const color = isComplete
          ? 'var(--status-ok)'
          : isCurrent
            ? STATUS_STYLE[job.status].color
            : 'var(--bg-overlay)';

        return (
          <div
            key={`${job.job_id}-${stage}`}
            className={isCurrent && STATUS_STYLE[job.status].pulse ? 'anim-pulse-glow' : ''}
            title={`${STAGE_LABELS[stage] ?? stage}: ${isComplete ? 'complete' : isCurrent ? job.status : 'pending'}`}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 999,
              background: color,
              opacity: isComplete || isCurrent ? 0.95 : 0.55,
            }}
          />
        );
      })}
    </div>
  );
}

function JobRow({ job, compact = false }: { job: PipelineJobSnapshot; compact?: boolean }) {
  const status = STATUS_STYLE[job.status];
  const latestEvent = job.history[job.history.length - 1];
  const progressPercent = getProgressPercent(job);

  return (
    <div
      className="flex flex-col gap-2 rounded-lg"
      style={{
        padding: compact ? '8px 10px' : '10px 12px',
        background: compact ? 'rgba(255,255,255,0.02)' : 'rgba(59,130,246,0.05)',
        border: `1px solid ${compact ? 'var(--border-subtle)' : 'rgba(59,130,246,0.16)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 11 : 12, color: '#e2e8f0', fontWeight: 700 }}>
            {getJobTarget(job)}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'capitalize' }}>
            {getJobSource(job)} · {STAGE_LABELS[job.current_stage] ?? job.current_stage} · {getRelativeTime(job.updated_at)}
          </div>
        </div>
        <span
          className={`badge ${status.badge} ${status.pulse ? 'anim-pulse-glow' : ''}`}
          style={{ fontSize: 8, whiteSpace: 'nowrap' }}
        >
          {status.label}
        </span>
      </div>

      <StageStrip job={job} />

      {!compact && (
        <div className="flex items-center justify-between">
          <span className="value-sm">{progressPercent}% flow</span>
          <span className="value-sm">
            try {job.attempts}/{job.max_retries}
          </span>
        </div>
      )}

      {!compact && latestEvent && (
        <div style={{ fontSize: 10, color: '#475569' }}>
          {latestEvent.error ?? latestEvent.message}
        </div>
      )}
    </div>
  );
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-0.5" style={{ flex: 1 }}>
      <span className="label">{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color }}>
        {value}
      </span>
    </div>
  );
}

export default function PipelineStatusCard() {
  const jobs = useSignVerseStore(state => state.pipelineJobs);
  const pipelineStatus = useSignVerseStore(state => state.pipelineStatus);
  const pipelineError = useSignVerseStore(state => state.pipelineError);
  const activeJobs = jobs.filter(job => !['completed', 'failed', 'cancelled'].includes(job.status));
  const latestJob = activeJobs[0] ?? jobs[0] ?? null;
  const queuedCount = jobs.filter(job => job.status === 'queued').length;
  const completedCount = jobs.filter(job => job.status === 'completed').length;
  const failedCount = jobs.filter(job => job.status === 'failed').length;
  const visibleJobs = jobs.filter(job => job.job_id !== latestJob?.job_id).slice(0, 3);

  return (
    <div className="card p-4 flex flex-col gap-3" style={{ minHeight: 250 }}>
      <div className="flex items-center justify-between">
        <span className="label">Pipeline Jobs</span>
        <span
          className={`badge ${pipelineStatus === 'error' ? 'badge-hard' : 'badge-info'}`}
          style={{ fontSize: 9 }}
        >
          {pipelineStatus === 'error' ? 'REST Error' : `${jobs.length} tracked`}
        </span>
      </div>

      <div className="flex gap-3">
        <SummaryChip label="Active" value={activeJobs.length} color="var(--status-info)" />
        <SummaryChip label="Queued" value={queuedCount} color="var(--status-warn)" />
        <SummaryChip label="Done" value={completedCount} color="var(--status-ok)" />
        <SummaryChip label="Failed" value={failedCount} color="var(--status-error)" />
      </div>

      {pipelineError && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--status-error)',
            fontSize: 10,
          }}
        >
          {pipelineError}
        </div>
      )}

      {!latestJob && pipelineStatus !== 'error' && (
        <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
          {pipelineStatus === 'loading' ? 'Loading pipeline jobs…' : 'Ingest media to create a pipeline job.'}
        </div>
      )}

      {latestJob && (
        <div className="flex flex-col gap-2">
          <span className="label">Current Flow</span>
          <JobRow job={latestJob} />
        </div>
      )}

      {visibleJobs.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="label">Recent Jobs</span>
          {visibleJobs.map(job => (
            <JobRow key={job.job_id} job={job} compact />
          ))}
        </div>
      )}
    </div>
  );
}
