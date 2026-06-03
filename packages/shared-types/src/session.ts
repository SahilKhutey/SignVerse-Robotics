export interface SessionRecord {
  id: string;
  name: string;
  createdAt: string;
  durationSeconds: number;
  frameCount: number;
  status: 'completed' | 'failed' | 'processing';
}

export interface TrainingStatus {
  epoch: number;
  loss: number;
  val_loss: number;
  status: 'idle' | 'training' | 'completed' | 'failed';
}

export interface SystemStatus {
  kernel: 'running' | 'stopped';
  uptime: number; // in seconds
  loopFrequency: {
    target: number;
    actual: number;
  };
  models: {
    behavior_cloning: 'loaded' | 'error' | 'loading';
    langchain_agent: 'loaded' | 'error' | 'loading';
    mediapipe_detector: 'loaded' | 'error' | 'loading';
    mujoco_sim: 'loaded' | 'error' | 'loading';
  };
  hardware: {
    webcamConnected: boolean;
    arduinoBridge: 'connected' | 'disconnected';
    arduinoDeviceName: string;
  };
  wsPingMs: number;
}

export interface SimEpisode {
  id: string;
  model_version: string;
  realSessionId: string;
  status: 'running' | 'completed' | 'failed';
  createdAt: number;
}

export interface DivergenceReport {
  realSessionId: string;
  simEpisodeId: string;
  perJointRmse: number[];       // radians
  overallScore: number;          // 0–1
  worstJointIndex: number;
}

