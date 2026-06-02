export const JOINT_TYPES = [
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
] as const;

export const MOTION_SEQUENCE_SCHEMA_VERSION = 'motion.sequence.v1';

export type JointType = (typeof JOINT_TYPES)[number];

export interface JointNode {
  id: number;
  joint_type: JointType;
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export type SkeletonGraph = Partial<Record<JointType, JointNode>>;

export interface MotionFrame {
  frame_id: number;
  timestamp: number;
  skeleton: SkeletonGraph;
}

export interface MotionSequenceMetadata {
  source?: string;
  actor_id?: string;
  capture_device?: string;
  labels?: string[];
  [key: string]: unknown;
}

export interface MotionSequence {
  schema_version: typeof MOTION_SEQUENCE_SCHEMA_VERSION;
  sequence_id: string;
  fps: number;
  frames: MotionFrame[];
  metadata: MotionSequenceMetadata;
}

export interface TrackingSequence {
  track_id: string;
  person_id: string;
  timestamps: number[];
}

export interface SemanticSegment {
  action: string;
  start_frame: number;
  end_frame: number;
  confidence?: number;
}
