import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function RobotArmRenderer({ angles }) {
  const baseRef = useRef();
  const shoulderRef = useRef();
  const elbowRef = useRef();

  useFrame(() => {
    if (angles) {
      // Apply angles from Retargeting Solver
      if (baseRef.current) {
        baseRef.current.rotation.y = THREE.MathUtils.degToRad(angles.base || 0);
      }
      if (shoulderRef.current) {
        // Pitch rotation
        shoulderRef.current.rotation.z = THREE.MathUtils.degToRad(angles.shoulder || 0);
      }
      if (elbowRef.current) {
        elbowRef.current.rotation.z = THREE.MathUtils.degToRad(angles.elbow || 0);
      }
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Base Cylinder */}
      <mesh ref={baseRef} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 0.2, 32]} />
        <meshStandardMaterial color="#374151" />
        
        {/* Shoulder Joint Group */}
        <group ref={shoulderRef} position={[0, 0.1, 0]}>
          {/* Upper Arm */}
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1, 16]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          <mesh position={[0, 0, 0]}>
             <sphereGeometry args={[0.1, 16, 16]} />
             <meshStandardMaterial color="#60a5fa" />
          </mesh>
          
          {/* Elbow Joint Group */}
          <group ref={elbowRef} position={[0, 1.0, 0]}>
            {/* Forearm */}
            <mesh position={[0, 0.4, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.8, 16]} />
              <meshStandardMaterial color="#10b981" />
            </mesh>
            <mesh position={[0, 0, 0]}>
               <sphereGeometry args={[0.08, 16, 16]} />
               <meshStandardMaterial color="#34d399" />
            </mesh>
          </group>
        </group>
      </mesh>
    </group>
  );
}
