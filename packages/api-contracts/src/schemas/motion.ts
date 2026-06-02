import { z } from 'zod';

export const MOTION_SEQUENCE_SCHEMA_VERSION = 'motion.sequence.v1';

export const JointTypeSchema = z.enum([
  'nose',
  'neck',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
]);

export const JointNodeSchema = z.object({
  id: z.number().int().nonnegative(),
  joint_type: JointTypeSchema,
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  confidence: z.number().min(0).max(1).default(1),
});

export const SkeletonGraphSchema = z.record(JointTypeSchema, JointNodeSchema);

export const MotionFrameSchema = z.object({
  frame_id: z.number().int().nonnegative(),
  timestamp: z.number().nonnegative(),
  skeleton: SkeletonGraphSchema,
});

export const MotionSequenceMetadataSchema = z
  .object({
    source: z.string().optional(),
    actor_id: z.string().optional(),
    capture_device: z.string().optional(),
    labels: z.array(z.string()).optional(),
  })
  .catchall(z.unknown());

export const MotionSequenceSchema = z.object({
  schema_version: z.literal(MOTION_SEQUENCE_SCHEMA_VERSION).default(MOTION_SEQUENCE_SCHEMA_VERSION),
  sequence_id: z.string().min(1),
  fps: z.number().int().positive(),
  frames: z.array(MotionFrameSchema),
  metadata: MotionSequenceMetadataSchema.default({}),
});

export const TrackingSequenceSchema = z.object({
  track_id: z.string().min(1),
  person_id: z.string().min(1),
  timestamps: z.array(z.number().nonnegative()),
});

export const SemanticSegmentSchema = z
  .object({
    action: z.string().min(1),
    start_frame: z.number().int().nonnegative(),
    end_frame: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .refine((segment) => segment.end_frame >= segment.start_frame, {
    message: 'end_frame must be greater than or equal to start_frame',
    path: ['end_frame'],
  });

export type JointType = z.infer<typeof JointTypeSchema>;
export type JointNode = z.infer<typeof JointNodeSchema>;
export type SkeletonGraph = z.infer<typeof SkeletonGraphSchema>;
export type MotionFrame = z.infer<typeof MotionFrameSchema>;
export type MotionSequence = z.infer<typeof MotionSequenceSchema>;
export type TrackingSequence = z.infer<typeof TrackingSequenceSchema>;
export type SemanticSegment = z.infer<typeof SemanticSegmentSchema>;
