import { z } from 'zod';

export const PipelineStageSchema = z.enum([
  'ingestion',
  'perception',
  'fusion',
  'kinematics',
  'simulation',
  'export',
]);

export const PipelineStatusSchema = z.enum([
  'queued',
  'processing',
  'completed',
  'failed',
  'retrying',
  'cancelled',
]);

export const PipelineEventSchema = z.object({
  stage: PipelineStageSchema,
  from_status: PipelineStatusSchema,
  to_status: PipelineStatusSchema,
  timestamp: z.string().min(1),
  message: z.string(),
  worker_id: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export const PipelineJobSnapshotSchema = z
  .object({
    job_id: z.string().min(1),
    stages: z.array(PipelineStageSchema).min(1),
    status: PipelineStatusSchema,
    current_stage: PipelineStageSchema,
    current_stage_index: z.number().int().nonnegative(),
    attempts: z.number().int().nonnegative(),
    max_retries: z.number().int().nonnegative(),
    metadata: z.record(z.unknown()),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
    history: z.array(PipelineEventSchema),
  })
  .refine((job) => job.current_stage_index < job.stages.length, {
    message: 'current_stage_index must refer to an existing stage',
    path: ['current_stage_index'],
  })
  .refine((job) => job.stages[job.current_stage_index] === job.current_stage, {
    message: 'current_stage must match current_stage_index',
    path: ['current_stage'],
  });

export type PipelineStage = z.infer<typeof PipelineStageSchema>;
export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;
export type PipelineEvent = z.infer<typeof PipelineEventSchema>;
export type PipelineJobSnapshot = z.infer<typeof PipelineJobSnapshotSchema>;
