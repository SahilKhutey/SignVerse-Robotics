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
            # Dummy feature extraction for MVP structure
            feature_vector = [0.0] * 33 # Replace with actual flattened rotations
            matrix.append(feature_vector)
            
        np_matrix = np.array(matrix, dtype=np.float32)
        np.save(file_path, np_matrix)
        
        return file_path
