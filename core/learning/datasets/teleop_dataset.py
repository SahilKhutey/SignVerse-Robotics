import sqlite3
import json
import torch
from torch.utils.data import Dataset
import numpy as np

from core.robotics.kinematics.inverse_kinematics import InverseKinematicsSolver

def dummy_fk(q):
    """
    Same dummy FK used in the live system to keep offline labels consistent.
    q: [shoulder, elbow, wrist]
    """
    L1, L2, L3 = 2.0, 2.0, 1.0
    x = L1 * np.cos(q[0]) + L2 * np.cos(q[0] + q[1]) + L3 * np.cos(q[0] + q[1] + q[2])
    y = L1 * np.sin(q[0]) + L2 * np.sin(q[0] + q[1]) + L3 * np.sin(q[0] + q[1] + q[2])
    z = q[0] * 0.5 
    return np.array([x, y, z])

class TeleopDataset(Dataset):
    def __init__(self, db_path="datasets/raw/teleoperation.db"):
        self.db_path = db_path
        self.samples = []
        
        self.ik_solver = InverseKinematicsSolver(dummy_fk)
        self._load_data()

    def _load_data(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT json_data FROM frames")
            rows = cursor.fetchall()
            
            for row in rows:
                if not row[0]:
                    continue
                data = json.loads(row[0])
                
                # Extract Right Hand landmarks (21 points * 3D = 63 features)
                if "Right Hand" in data and data["Right Hand"] is not None:
                    rh = np.array(data["Right Hand"])
                    if rh.shape == (21, 3):
                        x_features = rh.flatten()
                        
                        # Generate Ground Truth Y labels using Offline Inverse Kinematics
                        # We use the wrist (index 0) as the target spatial position
                        target_pos = rh[0] * 5.0  # Scale up for robot workspace
                        
                        # Solve for joint angles (Ground Truth)
                        ik_result = self.ik_solver.solve(initial_q=[0, 0, 0], target_pos=target_pos, max_iter=20)
                        
                        if ik_result["converged"]:
                            y_labels = ik_result["q"]
                            self.samples.append((x_features, y_labels))
                            
            conn.close()
            print(f"Loaded {len(self.samples)} valid behavior cloning samples from DB.")
        except Exception as e:
            print(f"Dataset Load Warning: {e}. If the DB is empty, an empty dataset is initialized.")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        x, y = self.samples[idx]
        return torch.tensor(x, dtype=torch.float32), torch.tensor(y, dtype=torch.float32)
