import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import RobotArm from './RobotArm';

interface RobotViewProps {
  jointAngles: number[];
  showReadouts?: boolean;
  label?: string;
  badge?: string;
  badgeColor?: string;
  isComparisonColor?: boolean;
}

export default function RobotView({
  jointAngles,
  showReadouts = false,
  label,
  badge,
  badgeColor = 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',
  isComparisonColor = false
}: RobotViewProps) {
  return (
    <div className="relative flex-1 rounded-xl overflow-hidden bg-gradient-to-b from-[#10141f] to-[#07080a] aspect-video border border-white/5 shadow-2xl">
      {/* 3D R3F Canvas */}
      <Canvas 
        shadows 
        camera={{ position: [2.0, 1.8, 2.8], fof: 45 } as any}
      >
        <color attach="background" args={['#08090c']} />
        
        {/* Lights */}
        <ambientLight intensity={0.4} />
        <directionalLight
          castShadow
          position={[5, 8, 5]}
          intensity={1.0}
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-bias={-0.0001}
        />
        
        {/* City Environment Map */}
        <Environment preset="city" />

        {/* Floor Grid */}
        <Grid
          position={[0, -0.6, 0]}
          args={[10.5, 10.5]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#1e222b"
          sectionSize={2.5}
          sectionThickness={1}
          sectionColor={isComparisonColor ? '#8e2de2' : '#00f0ff'}
          fadeDistance={10}
          fadeStrength={1}
          infiniteGrid
        />

        {/* Robot Arm */}
        <RobotArm 
          showReadouts={showReadouts} 
          position={[0, -0.6, 0]} 
          customJointAngles={jointAngles}
          isComparisonArm={isComparisonColor}
        />

        {/* Camera Control */}
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          maxPolarAngle={Math.PI / 2 - 0.05} 
          minDistance={1.0}
          maxDistance={6}
        />
      </Canvas>

      {/* View Header Labels */}
      {(label || badge) && (
        <div className="absolute top-3 left-3 right-3 flex justify-between items-center select-none pointer-events-none z-10">
          {label && (
            <span className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/5 text-[9px] font-display font-semibold tracking-widest text-text-primary uppercase backdrop-blur-sm">
              {label}
            </span>
          )}
          {badge && (
            <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold border backdrop-blur-sm ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
