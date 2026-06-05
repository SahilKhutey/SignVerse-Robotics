import { TelemetryFrame } from './telemetry';

export interface LearningEvent {
  type: "update_complete" | "checkpoint_saved" | "forgetting_detected" | "lr_adjusted";
  step: number;
  loss: number;
  val_accuracy: number;
  per_task_accuracy: Record<string, number>;
  learning_rate: number;
  replay_ratio: number;
  timestamp_ms: number;
}

export interface OnlineLearnerState {
  status: "idle" | "updating" | "paused" | "error";
  total_steps: number;
  current_lr: number;
  replay_buffer_size: number;
  checkpoint_count: number;
  last_checkpoint_step: number | null;
  ewc_lambda: number;
}

export interface ForgettingAlert {
  task_label: string;
  accuracy_before: number;
  accuracy_after: number;
  drop_percent: number;
  step: number;
}

export interface ReplayBufferEntry {
  session_id: string;
  label: string;
  frames: TelemetryFrame[];
  added_at: number;
  times_sampled: number;
}
