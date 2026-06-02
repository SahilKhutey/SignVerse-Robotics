export const PIPELINE_STAGES = [
  'ingestion',
  'perception',
  'fusion',
  'kinematics',
  'simulation',
  'export',
] as const;

export const PIPELINE_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
  'retrying',
  'cancelled',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export interface PipelineEvent {
  stage: PipelineStage;
  from_status: PipelineStatus;
  to_status: PipelineStatus;
  timestamp: string;
  message: string;
  worker_id?: string | null;
  error?: string | null;
}

export interface PipelineJobSnapshot {
  job_id: string;
  stages: PipelineStage[];
  status: PipelineStatus;
  current_stage: PipelineStage;
  current_stage_index: number;
  attempts: number;
  max_retries: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  history: PipelineEvent[];
}
