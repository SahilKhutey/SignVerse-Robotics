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
        
        # Standard T-Pose BVH Header (Simplified for MVP)
        bvh_string = "HIERARCHY\n"
        bvh_string += "ROOT Hips\n{\n"
        bvh_string += "  OFFSET 0.00 0.00 0.00\n"
        bvh_string += "  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation\n"
        bvh_string += "  JOINT Spine\n  {\n"
        bvh_string += "    OFFSET 0.00 10.00 0.00\n"
        bvh_string += "    CHANNELS 3 Zrotation Xrotation Yrotation\n"
        bvh_string += "    End Site\n    {\n      OFFSET 0.00 15.00 0.00\n    }\n"
        bvh_string += "  }\n"
        bvh_string += "}\n"
        
        # Motion Section
        bvh_string += "MOTION\n"
        bvh_string += f"Frames: {len(kinematics_data)}\n"
        bvh_string += f"Frame Time: {1.0/fps:.6f}\n"
        
        for frame in kinematics_data:
            # Flatten rotations into string. Dummy zero data for structural MVP
            rotations = "0.0 0.0 0.0 " * 3 # Root pos + Root Rot + Spine Rot
            bvh_string += f"{rotations.strip()}\n"
            
        with open(file_path, "w") as f:
            f.write(bvh_string)
            
        return file_path
