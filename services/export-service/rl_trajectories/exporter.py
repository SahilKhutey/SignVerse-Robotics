import os
import numpy as np

class RLExporter:
    def __init__(self, output_dir="exports/rl"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    def export(self, sequence_id, kinematics_data):
        '''
        Flattens the kinematics dictionary into a highly optimized binary .npy array
        so OpenAI Gym / MuJoCo can ingest it natively into VRAM.
        '''
        file_path = os.path.join(self.output_dir, f"{sequence_id}.npy")
        
        # Convert list of dicts to a 2D numpy array [frames, features]
        matrix = []
        for frame in kinematics_data:
            trans = frame.get("translation", [0.0, 0.0, 0.0])
            joints = frame.get("joints", {})
            j0 = joints.get("J0", joints.get("shoulder_pitch_r", 0.0))
            j1 = joints.get("J1", joints.get("shoulder_roll_r", 0.0))
            j2 = joints.get("J2", joints.get("elbow_pitch_r", 0.0))
            
            # Populate the feature vector with real translations and joint rotations, padding the rest to 33
            feature_vector = [
                trans[0], trans[1], trans[2],
                j0, j1, j2
            ] + [0.0] * 27
            matrix.append(feature_vector)
            
        np_matrix = np.array(matrix, dtype=np.float32)
        np.save(file_path, np_matrix)
        
        return file_path
