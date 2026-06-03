export interface CommandRequest {
  command: string;
  robotId?: string;
}

export interface CommandResponse {
  status: 'success' | 'failed' | 'processing';
  intent?: string;
  slots?: Record<string, any>;
  message?: string;
}
