export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface TelemetryFrame {
  jointAngles: number[]; // number[7]
  poseLandmarks: PoseLandmark[]; // PoseLandmark[33]
  aiPrediction: number[]; // number[7]
  confidence: number;
  timestampMs: number;
}
