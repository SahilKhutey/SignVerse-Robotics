import { TelemetryFrame, PoseLandmark } from './telemetry';

export * from './telemetry';
export * from './command';
export * from './session';

export interface LandmarkData {
  landmarks: PoseLandmark[];
}

export type WSMessage =
  | { type: 'telemetry'; data: TelemetryFrame }
  | { type: 'landmark'; data: LandmarkData }
  | { type: 'error'; message: string }
  | { type: 'pong'; ts: number }
  | { type: 'rtt'; rtt_ms: number };

