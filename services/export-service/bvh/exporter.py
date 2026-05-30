import os

class BVHExporter:
    def __init__(self, output_dir="exports/bvh"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    def export(self, sequence_id, kinematics_data, fps=30):
        '''
        Generates a strict .bvh text file containing the HIERARCHY and MOTION.
        '''
        file_path = os.path.join(self.output_dir, f"{sequence_id}.bvh")
        
        # Rigorous robotics structural BVH representation of Pelvis and joints
        bvh_string = (
            "HIERARCHY\n"
            "ROOT Pelvis\n"
            "{\n"
            "  OFFSET 0.0 0.0 0.0\n"
            "  CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation\n"
            "  JOINT Joint0\n"
            "  {\n"
            "    OFFSET 0.0 0.2 0.0\n"
            "    CHANNELS 3 Zrotation Yrotation Xrotation\n"
            "    JOINT Joint1\n"
            "    {\n"
            "      OFFSET 0.0 0.4 0.0\n"
            "      CHANNELS 3 Zrotation Yrotation Xrotation\n"
            "      End Site\n"
            "      {\n"
            "        OFFSET 0.0 0.2 0.0\n"
            "      }\n"
            "    }\n"
            "  }\n"
            "}\n"
        )
        
        # Motion Section
        bvh_string += "MOTION\n"
        bvh_string += f"Frames: {len(kinematics_data)}\n"
        bvh_string += f"Frame Time: {1.0/fps:.6f}\n"
        
        for frame in kinematics_data:
            trans = frame.get("translation", [0.0, 0.0, 0.0])
            joints = frame.get("joints", {})
            j0 = joints.get("J0", joints.get("shoulder_pitch_r", 0.0))
            j1 = joints.get("J1", joints.get("shoulder_roll_r", 0.0))
            
            # Write out pelvis translations, pelvis rotations (0,0,0), Joint0 (Z,Y,X) and Joint1 (Z,Y,X)
            frame_line = f"{trans[0]:.6f} {trans[1]:.6f} {trans[2]:.6f} 0.0 0.0 0.0 {j0:.6f} 0.0 0.0 {j1:.6f} 0.0 0.0\n"
            bvh_string += frame_line
            
        with open(file_path, "w") as f:
            f.write(bvh_string)
            
        return file_path
