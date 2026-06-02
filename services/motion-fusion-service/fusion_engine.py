import numpy as np
from typing import List, Dict, Any

class SkeletonFusionEngine:
    @staticmethod
    def fuse_joints(frames: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Fuses multiple skeleton frames from different detection sources.
        Each frame has format:
        {
            "joints": {
                "joint_name": {"x": float, "y": float, "z": float, "confidence": float},
                ...
            }
        }
        Fuses them using confidence-weighted coordinates.
        """
        if not frames:
            return {"joints": {}}
            
        fused_joints = {}
        all_joint_names = set()
        for f in frames:
            all_joint_names.update(f.get("joints", {}).keys())
            
        for name in all_joint_names:
            sum_weighted_x = 0.0
            sum_weighted_y = 0.0
            sum_weighted_z = 0.0
            sum_conf = 0.0
            
            for f in frames:
                joint = f.get("joints", {}).get(name)
                if joint:
                    conf = max(1e-5, joint.get("confidence", 0.0))
                    sum_weighted_x += joint["x"] * conf
                    sum_weighted_y += joint["y"] * conf
                    sum_weighted_z += joint["z"] * conf
                    sum_conf += conf
                    
            if sum_conf > 0:
                fused_joints[name] = {
                    "x": sum_weighted_x / sum_conf,
                    "y": sum_weighted_y / sum_conf,
                    "z": sum_weighted_z / sum_conf,
                    "confidence": sum_conf / len(frames)
                }
                
        return {"joints": fused_joints}
