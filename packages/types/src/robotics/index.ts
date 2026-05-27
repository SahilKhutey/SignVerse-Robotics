export interface Transform3D {
  position: [number, number, number];
  rotation: [number, number, number, number]; // Quaternion
  scale: [number, number, number];
}

export interface RobotState {
  id: string;
  transform: Transform3D;
  joints: Record<string, number>;
  status: 'active' | 'idle' | 'error';
}

export interface TwinState {
  robots: RobotState[];
  sensors: any[];
  physics: any;
  ai: any;
  environment: any;
}
