import time
import json
from typing import List, Dict, Any

class ROS2JointStateExporter:
    @staticmethod
    def serialize_joint_state(
        joint_names: List[str],
        positions: List[float],
        velocities: List[float] = None,
        efforts: List[float] = None
    ) -> Dict[str, Any]:
        """
        Serializes joint state trajectories into the standard ROS2 sensor_msgs/msg/JointState dictionary structure.
        """
        now = time.time()
        sec = int(now)
        nanosec = int((now - sec) * 1e9)
        
        # Populate velocities and effort arrays with zeros if none provided
        vel = velocities if velocities is not None else [0.0] * len(joint_names)
        eff = efforts if efforts is not None else [0.0] * len(joint_names)
        
        return {
            "header": {
                "stamp": {
                    "sec": sec,
                    "nanosec": nanosec
                },
                "frame_id": "base_link"
            },
            "name": joint_names,
            "position": positions,
            "velocity": vel,
            "effort": eff
        }

    @staticmethod
    def export_to_file(joint_state_msg: Dict[str, Any], output_path: str) -> None:
        """
        Saves the serialized ROS2 JointState message to a JSON file.
        """
        with open(output_path, "w") as f:
            json.dump(joint_state_msg, f, indent=2)
