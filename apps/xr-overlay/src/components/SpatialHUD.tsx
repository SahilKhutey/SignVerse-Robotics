'use client'
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export function SpatialHUD() {
  const textRef = useRef<any>();

  useFrame(({ clock }) => {
    if (textRef.current) {
      // Bobbing effect for HUD
      textRef.current.position.y = 1.5 + Math.sin(clock.elapsedTime * 2) * 0.05;
    }
  });

  return (
    <group position={[0, 1.5, -2]}>
      <mesh>
        <planeGeometry args={[1.5, 0.8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <Text
        ref={textRef}
        position={[-0.6, 0.2, 0.01]}
        fontSize={0.08}
        color="#4ade80"
        anchorX="left"
        anchorY="middle"
      >
        SIGN-VERSE AR TELEMETRY
      </Text>
      <Text
        position={[-0.6, 0, 0.01]}
        fontSize={0.06}
        color="#9ca3af"
        anchorX="left"
        anchorY="middle"
      >
        Gesture Status: ANALYZING
      </Text>
      <Text
        position={[-0.6, -0.2, 0.01]}
        fontSize={0.06}
        color="#9ca3af"
        anchorX="left"
        anchorY="middle"
      >
        Robot Link: CONNECTED
      </Text>
    </group>
  );
}
