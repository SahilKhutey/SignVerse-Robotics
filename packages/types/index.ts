// Unified schema definitions across Frontends and Backends
export interface RobotTelemetry {
  robot_id: string;
  status: "IDLE" | "ACTIVE" | "ERROR";
  battery: number;
  current_task?: string;
}

export interface InferenceStatus {
  sequence_id: string;
  fps: number;
  latency_ms: number;
  model_version: string;
}
