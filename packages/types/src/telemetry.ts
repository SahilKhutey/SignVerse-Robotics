import { JointState } from './robotics';
import { PoseLandmark } from './perception';

export interface TelemetryFrame {
  timestamp: number;
  robotId: string;
  joints: JointState[];
  landmarks: PoseLandmark[];
  aiPrediction?: string;
  confidence?: number;
  fps: number;
}
