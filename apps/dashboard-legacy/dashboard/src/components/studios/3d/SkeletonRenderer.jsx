import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';

export function SkeletonRenderer({ poseData }) {
  const pointsRef = useRef();

  // Convert MediaPipe [x,y,z] arrays to THREE.Vector3
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    return geo;
  }, []);

  // Update positions dynamically without full re-render
  if (poseData && poseData.length > 0) {
    const positions = new Float32Array(poseData.length * 3);
    for (let i = 0; i < poseData.length; i++) {
      // MediaPipe coordinates: X is left-right, Y is up-down, Z is depth.
      // Normalize to a roughly 2m tall bounding box centered at origin
      const lm = poseData[i];
      // Visibility threshold
      if (lm[3] < 0.5) continue;
      
      const x = (lm[0] - 0.5) * 2;   // Scale to [-1, 1]
      const y = -(lm[1] - 0.5) * 2;  // Invert Y for 3D and scale to [-1, 1]
      const z = -lm[2] * 2;          // Scale Z depth
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }

  // Define bone connections (MediaPipe Pose topology)
  // Just drawing basic joints for Phase 2 validation
  
  return (
    <group>
      {poseData && poseData.length > 0 && (
        <points geometry={geometry}>
          <pointsMaterial color="#10b981" size={0.05} sizeAttenuation={true} />
        </points>
      )}
    </group>
  );
}
