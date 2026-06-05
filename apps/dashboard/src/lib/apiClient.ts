import { VITE_API_URL } from './env';
import { OnlineLearnerState, ReplayBufferEntry } from '@signverse/shared-types';

export class APIError extends Error {
  public status: number;
  public payload: any;

  constructor(status: number, message: string, payload?: any) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.payload = payload;
  }
}

class APIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = VITE_API_URL;
  }

  public async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'signverse_local_dev_key',
      },
    });

    if (!response.ok) {
      let errorPayload;
      try {
        errorPayload = await response.json();
      } catch (err) {
        errorPayload = null;
      }
      throw new APIError(
        response.status,
        errorPayload?.message || `HTTP GET Request Failed: Status ${response.status}`,
        errorPayload
      );
    }

    return response.json() as Promise<T>;
  }

  public async post<T, U = any>(path: string, body: U): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'signverse_local_dev_key',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorPayload;
      try {
        errorPayload = await response.json();
      } catch (err) {
        errorPayload = null;
      }
      throw new APIError(
        response.status,
        errorPayload?.message || `HTTP POST Request Failed: Status ${response.status}`,
        errorPayload
      );
    }

    return response.json() as Promise<T>;
  }

  public getOnlineState(): Promise<OnlineLearnerState> {
    return this.get<OnlineLearnerState>('/api/online/state');
  }

  public setOnlinePause(paused: boolean): Promise<OnlineLearnerState> {
    return this.post<OnlineLearnerState, { paused: boolean }>('/api/online/pause', { paused });
  }

  public updateOnlineConfig(cfg: {
    learning_rate?: number;
    ewc_lambda?: number;
    replay_ratio?: number;
  }): Promise<OnlineLearnerState> {
    return this.post<OnlineLearnerState, typeof cfg>('/api/online/config', cfg);
  }

  public getOnlineReplayBuffer(
    page: number = 1,
    pageSize: number = 50
  ): Promise<{
    entries: ReplayBufferEntry[];
    capacity: number;
    fill_percent: number;
    total_count: number;
  }> {
    return this.get(`/api/online/replay_buffer?page=${page}&page_size=${pageSize}`);
  }
}

export const apiClient = new APIClient();
