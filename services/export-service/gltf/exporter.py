import os
import json
import math

class WebExporter:
    def __init__(self, output_dir="exports/gltf"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    def export(self, sequence_id, kinematics_data):
        '''
        Exports a standard glTF 2.0 format containing our skeletal arm hierarchy,
        with rotations converted to quaternion vectors [x, y, z, w].
        '''
        file_path = os.path.join(self.output_dir, f"{sequence_id}.gltf")
        
        # Build standard glTF 2.0 layout
        gltf = {
            "asset": {
                "version": "2.0",
                "generator": "SignVerse Export Service"
            },
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [
                {
                    "name": "BasePelvis",
                    "children": [1],
                    "translation": [0.0, 0.0, 0.0]
                },
                {
                    "name": "Joint0",
                    "children": [2],
                    "rotation": [0.0, 0.0, 0.0, 1.0]
                },
                {
                    "name": "Joint1",
                    "rotation": [0.0, 0.0, 0.0, 1.0]
                }
            ],
            "extra_simulation_frames": kinematics_data
        }
        
        if kinematics_data:
            # Map first frame initial pose to base structure
            first_frame = kinematics_data[0]
            trans = first_frame.get("translation", [0.0, 0.0, 0.0])
            joints = first_frame.get("joints", {})
            j0_deg = joints.get("J0", joints.get("shoulder_pitch_r", 0.0))
            j1_deg = joints.get("J1", joints.get("shoulder_roll_r", 0.0))
            
            # Convert degrees to Euler radians and then to quaternions
            j0_rad = math.radians(j0_deg)
            j1_rad = math.radians(j1_deg)
            
            # Rotation around Z-axis for Joint0, and Y-axis for Joint1
            q0 = [0.0, 0.0, math.sin(j0_rad / 2), math.cos(j0_rad / 2)]
            q1 = [0.0, math.sin(j1_rad / 2), 0.0, math.cos(j1_rad / 2)]
            
            gltf["nodes"][0]["translation"] = trans
            gltf["nodes"][1]["rotation"] = q0
            gltf["nodes"][2]["rotation"] = q1
            
        with open(file_path, "w") as f:
            json.dump(gltf, f, indent=2)
            
        return file_path
