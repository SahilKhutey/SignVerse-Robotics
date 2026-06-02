import {
  PipelineJobSnapshot,
  PipelineJobSnapshotSchema,
  PipelineStage,
} from '../schemas/pipeline';

export interface PipelineJobsResponse {
  status: 'success';
  jobs: PipelineJobSnapshot[];
  total: number;
}

export interface PipelineJobResponse {
  status: 'success';
  job: PipelineJobSnapshot;
}

export interface CreatePipelineJobPayload {
  job_id?: string;
  stages?: PipelineStage[];
  metadata?: Record<string, unknown>;
  max_retries?: number;
}

export interface StartPipelineJobPayload {
  worker_id?: string;
}

export interface CompletePipelineStagePayload {
  message?: string;
}

export interface FailPipelineJobPayload {
  error: string;
  retry?: boolean;
}

export interface CancelPipelineJobPayload {
  message?: string;
}

export interface SignVersePipelineClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}

export class SignVersePipelineClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: SignVersePipelineClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? fetch;
  }

  async listJobs(): Promise<PipelineJobsResponse> {
    const response = await this.request<PipelineJobsResponse>('/api/pipelines');
    return {
      ...response,
      jobs: response.jobs.map((job) => PipelineJobSnapshotSchema.parse(job)),
    };
  }

  async createJob(payload: CreatePipelineJobPayload = {}): Promise<PipelineJobResponse> {
    return this.jobRequest('/api/pipelines', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getJob(jobId: string): Promise<PipelineJobResponse> {
    return this.jobRequest(`/api/pipelines/${encodeURIComponent(jobId)}`);
  }

  async startJob(
    jobId: string,
    payload: StartPipelineJobPayload = {},
  ): Promise<PipelineJobResponse> {
    return this.jobRequest(`/api/pipelines/${encodeURIComponent(jobId)}/start`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async completeStage(
    jobId: string,
    payload: CompletePipelineStagePayload = {},
  ): Promise<PipelineJobResponse> {
    return this.jobRequest(`/api/pipelines/${encodeURIComponent(jobId)}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async failJob(
    jobId: string,
    payload: FailPipelineJobPayload,
  ): Promise<PipelineJobResponse> {
    return this.jobRequest(`/api/pipelines/${encodeURIComponent(jobId)}/fail`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancelJob(
    jobId: string,
    payload: CancelPipelineJobPayload = {},
  ): Promise<PipelineJobResponse> {
    return this.jobRequest(`/api/pipelines/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  private async jobRequest(
    path: string,
    init: RequestInit = {},
  ): Promise<PipelineJobResponse> {
    const response = await this.request<PipelineJobResponse>(path, init);
    return {
      ...response,
      job: PipelineJobSnapshotSchema.parse(response.job),
    };
  }

  private async request<TResponse>(
    path: string,
    init: RequestInit = {},
  ): Promise<TResponse> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
        ...init.headers,
      },
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        body && typeof body === 'object' && 'detail' in body
          ? String((body as { detail: unknown }).detail)
          : `HTTP ${response.status}`;
      throw new Error(`Pipeline API request failed: ${detail}`);
    }

    return body as TResponse;
  }
}
