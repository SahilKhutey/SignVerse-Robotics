import numpy as np
from typing import List, Dict, Any

class SkeletonFusion:
    """
    Fuses multiple skeletal detections (e.g. from multiple cameras or models)
    into a single unified skeleton representation.
    """
    def __init__(self, min_confidence: float = 0.1):
        self.min_confidence = min_confidence

    def fuse(self, frames: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Fuses multiple skeleton frames from different detection sources using
        confidence-weighted coordinate averages.
        Input format:
        [
            {
                "joints": {
                    "joint_name": {"x": float, "y": float, "z": float, "confidence": float}
                }
            },
            ...
        ]
        """
        if not frames:
            return {"joints": {}}
            
        fused_joints = {}
        all_joint_names = set()
        for f in frames:
            if "joints" in f:
                all_joint_names.update(f["joints"].keys())
                
        for joint_name in all_joint_names:
            x_sum = 0.0
            y_sum = 0.0
            z_sum = 0.0
            conf_sum = 0.0
            valid_sources = 0
            
            for f in frames:
                joint = f.get("joints", {}).get(joint_name)
                if joint:
                    conf = joint.get("confidence", 0.0)
                    if conf >= self.min_confidence:
                        weight = max(1e-5, conf)
                        x_sum += joint["x"] * weight
                        y_sum += joint["y"] * weight
                        z_sum += joint["z"] * weight
                        conf_sum += weight
                        valid_sources += 1
                        
            if conf_sum > 0:
                fused_joints[joint_name] = {
                    "x": x_sum / conf_sum,
                    "y": y_sum / conf_sum,
                    "z": z_sum / conf_sum,
                    "confidence": conf_sum / max(1, valid_sources)
                }
            else:
                # Fallback to the joint with maximum confidence if all are below min_confidence
                best_joint = None
                best_conf = -1.0
                for f in frames:
                    joint = f.get("joints", {}).get(joint_name)
                    if joint:
                        conf = joint.get("confidence", 0.0)
                        if conf > best_conf:
                            best_conf = conf
                            best_joint = joint
                if best_joint:
                    fused_joints[joint_name] = {
                        "x": best_joint["x"],
                        "y": best_joint["y"],
                        "z": best_joint["z"],
                        "confidence": best_joint["confidence"]
                    }
                    
        return {"joints": fused_joints}
