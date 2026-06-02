import { MOTION_SEQUENCE_SCHEMA_VERSION, MotionSequenceSchema } from '../schemas/motion';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface SchemaSummary {
  schema_id: string;
  title: string;
}

export interface SchemaCatalogResponse {
  status: 'success';
  schemas: SchemaSummary[];
}

export interface JsonSchemaResponse {
  status: 'success';
  schema_id: string;
  schema: JsonObject;
}

export interface SchemaValidationResponse<TPayload = unknown> {
  status: 'success';
  schema_id: string;
  payload: TPayload;
}

export interface SignVerseSchemaClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}

export class SignVerseSchemaClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: SignVerseSchemaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? fetch;
  }

  async listSchemas(): Promise<SchemaCatalogResponse> {
    return this.request<SchemaCatalogResponse>('/api/schemas');
  }

  async getSchema(schemaId: string): Promise<JsonSchemaResponse> {
    return this.request<JsonSchemaResponse>(`/api/schemas/${encodeURIComponent(schemaId)}`);
  }

  async validatePayload<TPayload = unknown>(
    schemaId: string,
    payload: unknown,
  ): Promise<SchemaValidationResponse<TPayload>> {
    return this.request<SchemaValidationResponse<TPayload>>(
      `/api/schemas/${encodeURIComponent(schemaId)}/validate`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async validateMotionSequence(payload: unknown) {
    const parsed = MotionSequenceSchema.parse(payload);
    return this.validatePayload(MOTION_SEQUENCE_SCHEMA_VERSION, parsed);
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
      throw new Error(`Schema API request failed: ${detail}`);
    }

    return body as TResponse;
  }
}
