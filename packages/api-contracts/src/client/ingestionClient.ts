import {
  IngestionQueuedResponse,
  IngestionQueuedResponseSchema,
  WebcamSignalResponse,
  WebcamSignalResponseSchema,
  YouTubeIngestionRequestSchema,
} from '../schemas/ingestion';

export interface SignVerseIngestionClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}

export class SignVerseIngestionClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: SignVerseIngestionClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? fetch;
  }

  async ingestYouTube(url: string): Promise<IngestionQueuedResponse> {
    const payload = YouTubeIngestionRequestSchema.parse({ url });
    return this.queuedRequest('/api/ingest/youtube', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async uploadVideo(file: File | Blob, filename?: string): Promise<IngestionQueuedResponse> {
    return this.uploadFile('/api/ingest/video', file, filename);
  }

  async uploadImage(file: File | Blob, filename?: string): Promise<IngestionQueuedResponse> {
    return this.uploadFile('/api/ingest/image', file, filename);
  }

  async signalWebcam(action: string): Promise<WebcamSignalResponse> {
    const response = await this.request<unknown>('/api/ingest/webcam', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    return WebcamSignalResponseSchema.parse(response);
  }

  private async uploadFile(
    path: string,
    file: File | Blob,
    filename?: string,
  ): Promise<IngestionQueuedResponse> {
    const form = new FormData();
    form.append('file', file, filename ?? ('name' in file ? String(file.name) : 'upload.bin'));
    return this.queuedRequest(path, {
      method: 'POST',
      body: form,
    });
  }

  private async queuedRequest(
    path: string,
    init: RequestInit = {},
  ): Promise<IngestionQueuedResponse> {
    const response = await this.request<unknown>(path, init);
    return IngestionQueuedResponseSchema.parse(response);
  }

  private async request<TResponse>(
    path: string,
    init: RequestInit = {},
  ): Promise<TResponse> {
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
      throw new Error(`Ingestion API request failed: ${detail}`);
    }

    return body as TResponse;
  }
}
