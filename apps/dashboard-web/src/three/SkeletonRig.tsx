import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface SkeletonRigProps {
    poseLandmarks: {x: number, y: number, z: number}[];
}

// Standard MediaPipe Pose connections
const POSE_CONNECTIONS = [
    [11, 12], // Shoulders
    [11, 13], [13, 15], // Left Arm
    [12, 14], [14, 16], // Right Arm
    [11, 23], [12, 24], // Torso
    [23, 24], // Hips
    [23, 25], [25, 27], // Left Leg
    [24, 26], [26, 28], // Right Leg
];

export function SkeletonRig({ poseLandmarks }: SkeletonRigProps) {
    
    // Scale and invert Y for standard Three.js coordinate space
    const scale = 2.0;
    
    const bones = useMemo(() => {
        if (!poseLandmarks || poseLandmarks.length < 33) return [];
        
        return POSE_CONNECTIONS.map((connection, idx) => {
            const startNode = poseLandmarks[connection[0]];
            const endNode = poseLandmarks[connection[1]];
            
            if (!startNode || !endNode) return null;
            
            const startVec = new THREE.Vector3((startNode.x - 0.5) * scale, -(startNode.y - 0.5) * scale, -startNode.z * scale);
            const endVec = new THREE.Vector3((endNode.x - 0.5) * scale, -(endNode.y - 0.5) * scale, -endNode.z * scale);
            
            return (
                <Line 
                    key={idx}
                    points={[startVec, endVec]}       
                    color="#00ffff"                   
                    lineWidth={3}                   
                />
            );
        });
    }, [poseLandmarks]);

    return (
        <group>
            {/* Draw joints as spheres */}
            {poseLandmarks && poseLandmarks.map((pt, i) => (
                <mesh key={`joint-${i}`} position={[(pt.x - 0.5) * scale, -(pt.y - 0.5) * scale, -pt.z * scale]}>
                    <sphereGeometry args={[0.03, 16, 16]} />
                    <meshStandardMaterial color="#ff00aa" />
                </mesh>
            ))}
            
            {/* Draw connecting bones */}
            {bones}
        </group>
    );
}
