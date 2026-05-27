'use client'
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';

// Placeholder Robot Arm Mesh
function RobotArmPlaceholder() {
  const baseRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (baseRef.current) {
      // Simulate telemetry driven movement
      baseRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.5;
    }
  });

  return (
    <group ref={baseRef}>
      {/* Base */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1, 1, 1, 32]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Joint 1 */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[0.5, 3, 0.5]} />
        <meshStandardMaterial color="#4ade80" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

export default function DigitalTwinViewport() {
  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <color attach="background" args={['#050505']} />
        
        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Environment preset="city" />

        <Grid 
          infiniteGrid 
          fadeDistance={20} 
          sectionColor="#222" 
          cellColor="#111" 
        />
        
        <RobotArmPlaceholder />
        
        <OrbitControls makeDefault />
      </Canvas>
      
      {/* Telemetry HUD Overlay */}
      <div className="absolute top-4 left-4 p-4 bg-black/80 border border-[#333] rounded-lg font-mono text-xs pointer-events-none">
        <h3 className="text-emerald-400 mb-2 font-bold tracking-wider">ROS2 KINEMATICS</h3>
        <div className="text-gray-400">J0: 45.2°</div>
        <div className="text-gray-400">J1: -12.1°</div>
        <div className="text-gray-400">J2: 88.0°</div>
        <div className="mt-2 text-blue-400 animate-pulse">SYNC: ACTIVE</div>
      </div>
    </div>
  );
}
