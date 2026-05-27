import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. 2D OpenCV Skeleton Overlay
write_file("services/perception-service/visualization/overlay_renderer.py", """import cv2
import mediapipe as mp
import numpy as np

mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_holistic = mp.solutions.holistic

class SkeletonRenderer:
    def __init__(self):
        '''
        High-performance OpenCV renderer for raw 2D visualization
        '''
        pass
        
    def draw_landmarks(self, image_bgr, landmarks_dict):
        '''
        Draws the pose, hands, and face over a cv2 image.
        landmarks_dict is expected to be a raw MediaPipe results object for the MVP.
        In a decoupled architecture, this reconstructs the NormalizedLandmarkList.
        '''
        annotated_image = image_bgr.copy()
        
        if landmarks_dict is None:
            return annotated_image

        # Since we decoupled Mediapipe in perception worker, we re-build standard arrays here
        # or just assume the input is the raw MediaPipe results for the visualization worker.
        results = landmarks_dict 
        
        # Draw face mesh
        if hasattr(results, 'face_landmarks') and results.face_landmarks:
            mp_drawing.draw_landmarks(
                annotated_image,
                results.face_landmarks,
                mp_holistic.FACEMESH_TESSELATION,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_tesselation_style())
                
        # Draw pose
        if hasattr(results, 'pose_landmarks') and results.pose_landmarks:
            mp_drawing.draw_landmarks(
                annotated_image,
                results.pose_landmarks,
                mp_holistic.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style())
                
        # Draw left hand
        if hasattr(results, 'left_hand_landmarks') and results.left_hand_landmarks:
            mp_drawing.draw_landmarks(
                annotated_image,
                results.left_hand_landmarks,
                mp_holistic.HAND_CONNECTIONS)
                
        # Draw right hand
        if hasattr(results, 'right_hand_landmarks') and results.right_hand_landmarks:
            mp_drawing.draw_landmarks(
                annotated_image,
                results.right_hand_landmarks,
                mp_holistic.HAND_CONNECTIONS)

        return annotated_image
""")

# 2. 3D Mesh Rendering Engine
write_file("services/perception-service/visualization/mesh_renderer.py", """import os

# Graceful degradation if trimesh/pyrender aren't installed or EGL is missing
try:
    import trimesh
    import pyrender
    import numpy as np
    PYRENDER_AVAILABLE = True
except ImportError:
    PYRENDER_AVAILABLE = False

class MeshRenderer:
    def __init__(self, resolution=(1920, 1080)):
        '''
        Headless 3D Mesh rendering context using PyRender.
        Requires EGL/OSMesa.
        '''
        self.resolution = resolution
        self.ready = False
        
        if PYRENDER_AVAILABLE:
            try:
                # EGL backend setup
                os.environ['PYOPENGL_PLATFORM'] = 'egl'
                self.renderer = pyrender.OffscreenRenderer(viewport_width=resolution[0], viewport_height=resolution[1])
                self.ready = True
            except Exception as e:
                print(f"Failed to initialize PyRender context (Likely missing EGL/Display): {e}")

    def render_mesh(self, vertices, faces, camera_pose=None):
        if not self.ready:
            # Return blank image if no renderer
            return np.zeros((self.resolution[1], self.resolution[0], 3), dtype=np.uint8)
            
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
        pr_mesh = pyrender.Mesh.from_trimesh(mesh, smooth=True)
        
        scene = pyrender.Scene(ambient_light=[0.3, 0.3, 0.3])
        scene.add(pr_mesh)
        
        # Add basic camera
        camera = pyrender.PerspectiveCamera(yfov=np.pi / 3.0, aspectRatio=1.0)
        if camera_pose is None:
            camera_pose = np.array([
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 3.0], # Push back
                [0.0, 0.0, 0.0, 1.0],
            ])
        scene.add(camera, pose=camera_pose)
        
        # Add light
        light = pyrender.DirectionalLight(color=[1.0, 1.0, 1.0], intensity=2.0)
        scene.add(light, pose=camera_pose)
        
        color, depth = self.renderer.render(scene)
        return color
""")

# 3. Frontend 3D Dashboard Upgrades
write_file("apps/dashboard-web/src/three/SkeletonRig.tsx", """import React, { useMemo } from 'react';
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
""")

print("Visualization Modules implemented.")
