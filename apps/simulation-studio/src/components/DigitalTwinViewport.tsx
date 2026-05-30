'use client'
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useRealtimeStream } from 'api-contracts';

interface RobotArmProps {
  j0: number; // angle in degrees
  j1: number; // angle in degrees
}

// Real-time kinematic chain driven by WebSocket joints
function KinematicRobotArm({ j0, j1 }: RobotArmProps) {
  const joint0Ref = useRef<any>(null);
  const joint1Ref = useRef<any>(null);

  // Convert angles to radians
  const j0Rad = THREE.MathUtils.degToRad(j0);
  const j1Rad = THREE.MathUtils.degToRad(j1);

  useFrame(() => {
    if (joint0Ref.current) {
      // Rotation around Z-axis
      joint0Ref.current.rotation.z = j0Rad;
    }
    if (joint1Ref.current) {
      // Rotation around Y-axis
      joint1Ref.current.rotation.y = j1Rad;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Base Pelvis (Static) */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.5, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Joint 0 Group */}
      <group ref={joint0Ref} position={[0, 0.5, 0]}>
        {/* Link 0 (Shoulder link) */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 1.0, 16]} />
          <meshStandardMaterial color="#4ade80" metalness={0.7} roughness={0.3} />
        </mesh>
        
        {/* Joint 1 Group (offset by Link 0 length) */}
        <group ref={joint1Ref} position={[0, 1.0, 0]}>
          {/* Link 1 (Elbow link) */}
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.2, 1.0, 0.2]} />
            <meshStandardMaterial color="#3b82f6" metalness={0.7} roughness={0.3} />
          </mesh>
          
          {/* Tool Tip / End Effector */}
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export default function DigitalTwinViewport() {
  // Subscribe to central Fastify telemetry stream on port 3000
  const telemetry = useRealtimeStream('ws://localhost:3000/ws/telemetry');

  // Extract angles with default fallback if not connected
  const J0 = telemetry.data && telemetry.data.joints ? telemetry.data.joints.J0 : 0.0;
  const J1 = telemetry.data && telemetry.data.joints ? telemetry.data.joints.J1 : 0.0;

  return (
    <div className="w-full h-full absolute inset-0 bg-[#050505] overflow-hidden">
      <Canvas camera={{ position: [2, 3, 4], fov: 50 }}>
        <color attach="background" args={['#050505']} />
        
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} />
        <Environment preset="city" />

        <Grid 
          infiniteGrid 
          fadeDistance={20} 
          sectionColor="#222" 
          cellColor="#111" 
        />
        
        {/* Render real kinematic chain driven by WebSocket joints */}
        <KinematicRobotArm j0={J0} j1={J1} />
        
        <OrbitControls makeDefault />
      </Canvas>
      
      {/* Live Telemetry HUD Overlay */}
      <div className="absolute top-4 left-4 p-4 bg-black/85 border border-neutral-800 rounded-xl font-mono text-xs pointer-events-none shadow-2xl backdrop-blur-md">
        <h3 className="text-emerald-400 mb-2 font-bold tracking-wider">ROS2 DIGITAL TWIN HUD</h3>
        <div className="text-neutral-400 flex justify-between gap-6 mb-1">
          <span>JOINT 0 (Base Roll):</span>
          <span className="text-emerald-400 font-semibold">{J0.toFixed(2)}°</span>
        </div>
        <div className="text-neutral-400 flex justify-between gap-6 mb-2">
          <span>JOINT 1 (Shoulder Pitch):</span>
          <span className="text-emerald-400 font-semibold">{J1.toFixed(2)}°</span>
        </div>
        <div className="border-t border-neutral-800 pt-2 flex items-center justify-between">
          <span className="text-neutral-500">GATEWAY STATUS:</span>
          <span className={telemetry.isConnected ? "text-emerald-400 animate-pulse font-bold" : "text-red-500 font-bold"}>
            {telemetry.isConnected ? "SYNC: ACTIVE" : "SYNC: OFFLINE"}
          </span>
        </div>
      </div>
    </div>
  );
}
