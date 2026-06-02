'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { SignVerseIngestionClient, type IngestionQueuedResponse } from 'api-contracts';
import { API_KEY, API_URL, refreshPipelineJobs } from '../state/signverse-store';

type LaunchStatus = 'idle' | 'submitting' | 'success' | 'error';

interface LaunchState {
  status: LaunchStatus;
  message: string;
  pipelineJobId?: string;
}

function describeResult(response: IngestionQueuedResponse): string {
  const sourceType = String(response.pipeline_job.metadata['source_type'] ?? 'media');
  const queueMode = String(response.pipeline_job.metadata['queue_mode'] ?? 'queued');
  return `${sourceType} accepted via ${queueMode}`;
}

function statusColor(status: LaunchStatus): string {
  if (status === 'success') return 'var(--status-ok)';
  if (status === 'error') return 'var(--status-error)';
  if (status === 'submitting') return 'var(--status-info)';
  return '#64748b';
}

export default function IngestionLauncherCard() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [launchState, setLaunchState] = useState<LaunchState>({
    status: 'idle',
    message: 'Queue YouTube, image, or video media into the pipeline.',
  });

  const ingestionClient = useMemo(
    () => new SignVerseIngestionClient({ baseUrl: API_URL, apiKey: API_KEY }),
    [],
  );

  const isSubmitting = launchState.status === 'submitting';

  async function runIngestion(
    actionLabel: string,
    action: () => Promise<IngestionQueuedResponse>,
  ) {
    setLaunchState({
      status: 'submitting',
      message: `${actionLabel}...`,
    });

    try {
      const response = await action();
      setLaunchState({
        status: 'success',
        message: describeResult(response),
        pipelineJobId: response.pipeline_job_id,
      });
      await refreshPipelineJobs();
    } catch (error) {
      setLaunchState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Ingestion request failed',
      });
    }
  }

  async function submitYouTube(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = youtubeUrl.trim();
    if (!trimmedUrl) {
      setLaunchState({
        status: 'error',
        message: 'Paste a YouTube URL before queueing.',
      });
      return;
    }

    await runIngestion('Queueing YouTube source', () => ingestionClient.ingestYouTube(trimmedUrl));
  }

  async function uploadMedia(
    event: ChangeEvent<HTMLInputElement>,
    mediaType: 'image' | 'video',
  ) {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];
    if (!selectedFile) return;

    await runIngestion(
      `Uploading ${mediaType} ${selectedFile.name}`,
      () => mediaType === 'image'
        ? ingestionClient.uploadImage(selectedFile)
        : ingestionClient.uploadVideo(selectedFile),
    );

    input.value = '';
  }

  return (
    <div className="card p-4 flex flex-col gap-3" style={{ minHeight: 180 }}>
      <div className="flex items-center justify-between">
        <span className="label">Ingestion Launcher</span>
        <span
          className={`badge ${launchState.status === 'error' ? 'badge-hard' : 'badge-info'}`}
          style={{ fontSize: 9 }}
        >
          {isSubmitting ? 'Queueing' : 'Ready'}
        </span>
      </div>

      <form className="flex gap-2" onSubmit={submitYouTube}>
        <input
          aria-label="YouTube URL"
          disabled={isSubmitting}
          onChange={(event) => setYoutubeUrl(event.currentTarget.value)}
          placeholder="https://youtube.com/watch?v=..."
          style={{
            flex: 1,
            minWidth: 0,
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            color: '#e2e8f0',
            fontSize: 12,
            outline: 'none',
            padding: '8px 10px',
          }}
          type="url"
          value={youtubeUrl}
        />
        <button
          disabled={isSubmitting}
          style={{
            border: '1px solid rgba(56,189,248,0.35)',
            borderRadius: 'var(--radius-md)',
            background: isSubmitting ? 'rgba(56,189,248,0.08)' : 'rgba(56,189,248,0.16)',
            color: 'var(--status-info)',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '0 12px',
            textTransform: 'uppercase',
          }}
          type="submit"
        >
          Queue URL
        </button>
      </form>

      <div className="flex gap-2">
        <label className="badge badge-info" style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
          Image
          <input
            accept="image/*"
            disabled={isSubmitting}
            onChange={(event) => void uploadMedia(event, 'image')}
            style={{ display: 'none' }}
            type="file"
          />
        </label>
        <label className="badge badge-info" style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
          Video
          <input
            accept="video/*"
            disabled={isSubmitting}
            onChange={(event) => void uploadMedia(event, 'video')}
            style={{ display: 'none' }}
            type="file"
          />
        </label>
        {launchState.pipelineJobId && (
          <span className="value-sm" style={{ marginLeft: 'auto' }}>
            {launchState.pipelineJobId.slice(0, 16)}...
          </span>
        )}
      </div>

      <div
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(255,255,255,0.02)',
          color: statusColor(launchState.status),
          fontSize: 11,
          padding: '8px 10px',
        }}
      >
        {launchState.message}
      </div>
    </div>
  );
}
