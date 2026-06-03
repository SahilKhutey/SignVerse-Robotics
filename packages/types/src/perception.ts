export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PerceptionData {
  landmarks: PoseLandmark[];
  gesture?: string;
  confidence?: number;
}
