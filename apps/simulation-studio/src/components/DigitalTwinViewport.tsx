'use client';
import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { TwinSynchronizer } from '@signverse/simulation-engine';

const synchronizer = new TwinSynchronizer();

export function DigitalTwinViewport() {
  
  useEffect(() => {
    // Mock Telemetry Ingestion Loop
    const interval = setInterval(() => {
      synchronizer.updateRobotState({
        robotId: 'sim_robot_001',
        position: [Math.sin(Date.now()/1000) * 2, 0.5, Math.cos(Date.now()/1000) * 2],
        rotation: [0, 0, 0, 1]
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
      <color attach="background" args={['#1a1a1a']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <Grid infiniteGrid fadeDistance={20} cellColor="#444" sectionColor="#888" />
      <Physics>
         {/* ECS Entities will be rendered here via Miniplex React bindings in Sprint 2 */}
         <mesh position={[0, 0.5, 0]}>
           <boxGeometry args={[1, 1, 1]} />
           <meshStandardMaterial color="hotpink" />
         </mesh>
      </Physics>
      <OrbitControls makeDefault />
    </Canvas>
  );
}
