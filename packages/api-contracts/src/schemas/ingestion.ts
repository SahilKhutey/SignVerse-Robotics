import { z } from 'zod';
import { PipelineJobSnapshotSchema } from './pipeline';

export const IngestionSourceTypeSchema = z.enum(['video', 'youtube', 'image', 'webcam']);

export const YouTubeIngestionRequestSchema = z.object({
  url: z.string().url(),
});

export const WebcamSignalRequestSchema = z.object({
  action: z.string().min(1),
});

export const IngestionQueuedResponseSchema = z.object({
  status: z.literal('success'),
  message: z.string().optional(),
  url: z.string().optional(),
  filename: z.string().optional(),
  path: z.string().optional(),
  job_id: z.string().nullable(),
  pipeline_job_id: z.string().min(1),
  pipeline_job: PipelineJobSnapshotSchema,
});

export const WebcamSignalResponseSchema = z.object({
  status: z.literal('success'),
  message: z.string(),
});

export type IngestionSourceType = z.infer<typeof IngestionSourceTypeSchema>;
export type YouTubeIngestionRequest = z.infer<typeof YouTubeIngestionRequestSchema>;
export type WebcamSignalRequest = z.infer<typeof WebcamSignalRequestSchema>;
export type IngestionQueuedResponse = z.infer<typeof IngestionQueuedResponseSchema>;
export type WebcamSignalResponse = z.infer<typeof WebcamSignalResponseSchema>;
