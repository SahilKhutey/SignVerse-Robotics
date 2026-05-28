import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { RobotArm } from './RobotArm';
import { useTelemetryStore } from '../store/telemetryStore';

export function StagePanel() {
  const telemetry = useTelemetryStore(state => state.telemetry);
  const isConnected = useTelemetryStore(state => state.isConnected);
  
  return (
    <div className={`glass-panel ${isConnected ? 'active' : ''}`} style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
      
      {/* HUD Overlay */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, pointerEvents: 'none' }}>
        <div className="panel-header" style={{ border: 'none', margin: 0 }}>2D/3D Simulation & Export Viewport // STAGE</div>
        <div style={{ fontFamily: 'var(--font-console)', fontSize: '10px', color: 'var(--color-outline)', marginBottom: '16px' }}>
          MODE: {isConnected ? 'TELEOPERATION_LIVE' : 'STANDBY'} <br/>
          RENDER: WebGL 60FPS
        </div>
        
        {/* Export & View Controls (Pointer events enabled to allow clicking) */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '10px' }}>Export FBX</button>
            <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '10px' }}>Export BVH</button>
            <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '10px' }}>Export URDF</button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ padding: '6px 12px', fontSize: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--color-outline)', borderRadius: '4px', cursor: 'pointer' }}>Toggle 2D Overlay</button>
            <button style={{ padding: '6px 12px', fontSize: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--color-outline)', borderRadius: '4px', cursor: 'pointer' }}>Reset 3D Camera</button>
          </div>
        </div>
      </div>

      {/* 3D Canvas */}
      <div style={{ flex: 1, position: 'relative', background: 'radial-gradient(circle at center, #122131 0%, #051424 100%)' }}>
        <Canvas camera={{ position: [5, 5, 8], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} color="#4edea3" />
          <pointLight position={[-10, -10, -5]} intensity={0.5} color="#051424" />
          
          <Suspense fallback={null}>
            {/* The 3D Grid Floor */}
            <Grid 
              renderOrder={-1} 
              position={[0, -2, 0]} 
              infiniteGrid 
              cellSize={1} 
              cellThickness={1} 
              sectionSize={5} 
              sectionThickness={1.5} 
              sectionColor="#4edea3" 
              fadeDistance={30} 
            />
            
            <RobotArm q_target={telemetry?.q_target || [0, 0, 0]} />
            
            <OrbitControls 
              enablePan={true} 
              enableZoom={true} 
              enableRotate={true}
              minDistance={2}
              maxDistance={20}
              maxPolarAngle={Math.PI / 2 + 0.1} // Prevent going too far below ground
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
