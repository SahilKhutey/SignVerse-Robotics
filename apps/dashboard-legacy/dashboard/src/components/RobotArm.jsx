import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function RobotArm({ q_target }) {
  // q_target is an array of 3 angles: [shoulder, elbow, wrist]
  const targetShoulder = q_target?.[0] || 0;
  const targetElbow = q_target?.[1] || 0;
  const targetWrist = q_target?.[2] || 0;

  // Refs to bypass React reconciliation overhead
  const shoulderRef = useRef();
  const elbowRef = useRef();
  const wristRef = useRef();
  const upperArmRef = useRef();

  // Smooth LERPing per frame
  useFrame((state, delta) => {
    // Determine interpolation speed (higher = faster snap)
    const lerpSpeed = 10; 

    if (shoulderRef.current) {
      shoulderRef.current.rotation.y = THREE.MathUtils.lerp(
        shoulderRef.current.rotation.y, 
        targetShoulder, 
        lerpSpeed * delta
      );
    }
    
    if (upperArmRef.current) {
      upperArmRef.current.rotation.z = THREE.MathUtils.lerp(
        upperArmRef.current.rotation.z, 
        targetShoulder * 0.5, 
        lerpSpeed * delta
      );
    }

    if (elbowRef.current) {
      elbowRef.current.rotation.x = THREE.MathUtils.lerp(
        elbowRef.current.rotation.x, 
        targetElbow, 
        lerpSpeed * delta
      );
    }

    if (wristRef.current) {
      wristRef.current.rotation.z = THREE.MathUtils.lerp(
        wristRef.current.rotation.z, 
        targetWrist, 
        lerpSpeed * delta
      );
    }
  });

  // Aesthetic material for the robotic arm (Holographic Emerald)
  const armMaterial = (
    <meshStandardMaterial 
      color="#4edea3" 
      emissive="#10b981"
      emissiveIntensity={0.2}
      transparent
      opacity={0.8}
      wireframe={false}
    />
  );
  
  const jointMaterial = (
    <meshStandardMaterial 
      color="#051424" 
      emissive="#4edea3"
      emissiveIntensity={0.5}
      wireframe={true}
    />
  );

  return (
    <group position={[0, -2, 0]}>
      {/* Base */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1, 1.2, 1, 32]} />
        {armMaterial}
      </mesh>

      {/* Shoulder Joint */}
      <group position={[0, 1, 0]} ref={shoulderRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.6, 0.6, 1.2, 32]} />
          {jointMaterial}
        </mesh>

        {/* Upper Arm */}
        <group position={[0, 0, 0]} ref={upperArmRef}> 
           {/* Added slight tilt based on shoulder for more dynamic movement */}
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[0.5, 3, 0.5]} />
            {armMaterial}
          </mesh>

          {/* Elbow Joint */}
          <group position={[0, 3, 0]} ref={elbowRef}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
              {jointMaterial}
            </mesh>

            {/* Lower Arm */}
            <mesh position={[0, 1.5, 0]}>
              <boxGeometry args={[0.4, 3, 0.4]} />
              {armMaterial}
            </mesh>

            {/* Wrist Joint */}
            <group position={[0, 3, 0]} ref={wristRef}>
              <mesh>
                <sphereGeometry args={[0.4, 16, 16]} />
                {jointMaterial}
              </mesh>
              
              {/* End Effector */}
              <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.1, 0.3, 1, 16]} />
                {armMaterial}
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
