import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useLandmarksStore } from '../../store/landmarks';

interface PoseSkeletonProps {
  showSkeleton: boolean;
}

// MediaPipe holistic body pose connections
const SKELETON_CONNECTIONS = [
  [11, 12], // Left shoulder to right shoulder
  [11, 13], [13, 15], // Left arm: shoulder -> elbow -> wrist
  [12, 14], [14, 16], // Right arm: shoulder -> elbow -> wrist
  // Hand finger points
  [15, 17], [15, 19], [15, 21], // Left hand fingers
  [16, 18], [16, 20], [16, 22], // Right hand fingers
  // Torso
  [11, 23], [12, 24], [23, 24], // Shoulders to hips, hips line
];

export default function PoseSkeleton({ showSkeleton }: PoseSkeletonProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  
  // Create references for the 33 sphere meshes
  const sphereRefs = useRef<THREE.Mesh[]>([]);

  // Scaling parameters to map normalized MediaPipe [0..1] range into the 3D world
  const scale = 2.0;
  const yOffset = 0.5;

  useFrame(() => {
    if (!groupRef.current) return;

    if (!showSkeleton) {
      groupRef.current.visible = false;
      return;
    }

    const landmarkData = useLandmarksStore.getState().landmarks;
    
    // Hide if no landmark frames are active
    if (!landmarkData || !landmarkData.landmarks || landmarkData.landmarks.length === 0) {
      groupRef.current.visible = false;
      return;
    }

    const landmarks = landmarkData.landmarks;

    groupRef.current.visible = true;

    // 1. Update sphere mesh positions in place
    for (let i = 0; i < 33; i++) {
      const lm = landmarks[i];
      const mesh = sphereRefs.current[i];
      if (lm && mesh) {
        // MediaPipe X is [0..1] left-to-right. Map to [-1..1]
        // MediaPipe Y is [0..1] top-to-bottom. Map to [1..-1]
        const x = (lm.x - 0.5) * scale;
        const y = (0.5 - lm.y) * scale + yOffset;
        const z = (lm.z - 0.5) * scale;
        mesh.position.set(x, y, z);
        mesh.visible = lm.visibility > 0.5; // only show highly visible joints
      }
    }

    // 2. Build and update line segments geometry
    const linePositions: number[] = [];
    SKELETON_CONNECTIONS.forEach(([a, b]) => {
      const lmA = landmarks[a];
      const lmB = landmarks[b];

      // Draw connection only if both nodes are visible
      if (lmA && lmB && lmA.visibility > 0.5 && lmB.visibility > 0.5) {
        const xA = (lmA.x - 0.5) * scale;
        const yA = (0.5 - lmA.y) * scale + yOffset;
        const zA = (lmA.z - 0.5) * scale;

        const xB = (lmB.x - 0.5) * scale;
        const yB = (0.5 - lmB.y) * scale + yOffset;
        const zB = (lmB.z - 0.5) * scale;

        linePositions.push(xA, yA, zA);
        linePositions.push(xB, yB, zB);
      }
    });

    if (lineRef.current && linePositions.length > 0) {
      const geom = lineRef.current.geometry;
      geom.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(linePositions, 3)
      );
      geom.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={[-1.2, 0, -0.4]} scale={0.7}>
      {/* 33 joint spheres */}
      {Array.from({ length: 33 }).map((_, i) => (
        <mesh 
          key={i} 
          ref={(el) => { if (el) sphereRefs.current[i] = el; }}
        >
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.65} />
        </mesh>
      ))}

      {/* Connective bones */}
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(0), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#8e2de2" linewidth={1.5} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}
