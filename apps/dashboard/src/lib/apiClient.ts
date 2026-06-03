import { VITE_API_URL } from './env';

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
}

export const apiClient = new APIClient();
