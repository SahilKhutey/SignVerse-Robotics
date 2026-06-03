export interface JointState {
  name: string;
  angle: number;
  velocity: number;
  torque: number;
}

export interface Transform3D {
  position: [number, number, number];
  rotation: [number, number, number, number]; // Quaternion
  scale: [number, number, number];
}

export interface RobotState {
  id: string;
  transform: Transform3D;
  joints: JointState[];
  status: 'active' | 'idle' | 'error';
}
