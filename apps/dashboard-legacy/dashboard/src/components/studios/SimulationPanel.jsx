import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useRobotStore } from '../../store/robotStore';
import { SkeletonRenderer } from './3d/SkeletonRenderer';
import { RobotArmRenderer } from './3d/RobotArmRenderer';

export function SimulationPanel() {
  const livePose = useRobotStore(state => state.livePose);
  const robotAngles = useRobotStore(state => state.robotAngles);
  const liveGesture = useRobotStore(state => state.liveGesture);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--os-bg-viewport)' }}>
      {/* 3D Viewport HUD */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--os-font-mono)', color: 'var(--os-text-secondary)', border: '1px solid var(--os-border-color)' }}>
        <div style={{ color: 'var(--os-accent-primary)', marginBottom: '4px' }}>DIGITAL TWIN ENGINE</div>
        <div>Camera: Orbit</div>
        <div>IK Target: {robotAngles ? 'ACTIVE' : 'IDLE'}</div>
        <div style={{ marginTop: '8px', color: 'var(--os-status-success)' }}>
          {liveGesture && `GESTURE DETECTED: ${liveGesture.gesture.toUpperCase()}`}
        </div>
      </div>

      <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        
        {/* Render Live Pose Skeleton (Offset to the left) */}
        <group position={[-1, 0, 0]}>
          <SkeletonRenderer poseData={livePose} />
        </group>

        {/* Render Retargeted Robot Arm (Offset to the right) */}
        <group position={[1, 0, 0]}>
           <RobotArmRenderer angles={robotAngles} />
        </group>
        
        <Grid infiniteGrid fadeDistance={20} sectionColor="#1f2937" cellColor="#111827" />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};
