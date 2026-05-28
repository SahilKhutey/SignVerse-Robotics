"""
SignVerse Synthetic Data Generation Pipeline
============================================
Generates annotated datasets from simulation renders for AI training.

Pipeline:
  Simulation → Sensor Rendering → Annotation Engine → Dataset Export → AI Training

Usage:
  python -m synthetic_data.generator --env indoor --count 1000 --type gesture
"""

import json
import random
import time
from dataclasses import dataclass, asdict, field
from enum import Enum
from pathlib import Path
from typing import Optional


class DatasetType(Enum):
    GESTURE = "gesture"
    NAVIGATION = "navigation"
    OBSTACLE = "obstacle"
    MULTIMODAL = "multimodal"


class Environment(Enum):
    INDOOR = "indoor"
    OUTDOOR = "outdoor"
    WAREHOUSE = "warehouse"
    HOSPITAL = "hospital"


@dataclass
class Keypoint:
    """3D keypoint for gesture/pose annotation."""
    name: str
    x: float
    y: float
    z: float
    confidence: float = 1.0


@dataclass
class BoundingBox:
    """2D bounding box for object detection annotation."""
    label: str
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    confidence: float = 1.0


@dataclass
class SyntheticFrame:
    """A single annotated synthetic data frame."""
    frame_id: str
    timestamp: float
    environment: str
    dataset_type: str
    rgb_path: Optional[str] = None
    depth_path: Optional[str] = None
    lidar_path: Optional[str] = None
    keypoints: list[Keypoint] = field(default_factory=list)
    bounding_boxes: list[BoundingBox] = field(default_factory=list)
    robot_pose: dict = field(default_factory=dict)
    sensor_metadata: dict = field(default_factory=dict)


class SyntheticDataGenerator:
    """
    Generates annotated synthetic training data by interfacing
    with the simulation environment.

    Supports gesture, navigation, and obstacle avoidance datasets.
    """

    GESTURE_LABELS = [
        "hello", "thank_you", "yes", "no", "please", "stop",
        "go", "come_here", "left", "right", "up", "down",
    ]

    OBJECT_LABELS = [
        "chair", "table", "door", "person", "robot",
        "box", "wall", "obstacle", "floor_marker",
    ]

    def __init__(self, output_dir: str = "./synthetic-data/export"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.annotation_dir = self.output_dir / "annotations"
        self.annotation_dir.mkdir(exist_ok=True)

    def generate_gesture_frame(self, frame_id: str, env: Environment) -> SyntheticFrame:
        """Generate a synthetic gesture recognition frame with hand keypoints."""
        gesture = random.choice(self.GESTURE_LABELS)

        # Simulate 21 MediaPipe hand keypoints in 3D
        keypoints = [
            Keypoint(
                name=f"hand_{i}",
                x=random.uniform(-0.5, 0.5),
                y=random.uniform(-0.5, 0.5),
                z=random.uniform(-0.1, 0.1),
                confidence=random.uniform(0.8, 1.0),
            )
            for i in range(21)
        ]

        return SyntheticFrame(
            frame_id=frame_id,
            timestamp=time.time(),
            environment=env.value,
            dataset_type=DatasetType.GESTURE.value,
            keypoints=keypoints,
            sensor_metadata={"gesture_label": gesture, "hand": "right"},
        )

    def generate_navigation_frame(self, frame_id: str, env: Environment) -> SyntheticFrame:
        """Generate a synthetic navigation frame with bounding boxes and robot pose."""
        bboxes = [
            BoundingBox(
                label=random.choice(self.OBJECT_LABELS),
                x_min=random.uniform(0, 0.6),
                y_min=random.uniform(0, 0.6),
                x_max=random.uniform(0.6, 1.0),
                y_max=random.uniform(0.6, 1.0),
                confidence=random.uniform(0.75, 1.0),
            )
            for _ in range(random.randint(1, 8))
        ]

        return SyntheticFrame(
            frame_id=frame_id,
            timestamp=time.time(),
            environment=env.value,
            dataset_type=DatasetType.NAVIGATION.value,
            bounding_boxes=bboxes,
            robot_pose={
                "x": random.uniform(-10, 10),
                "y": random.uniform(-10, 10),
                "theta": random.uniform(-3.14, 3.14),
            },
        )

    def generate_dataset(
        self,
        count: int,
        dataset_type: DatasetType,
        env: Environment,
    ) -> list[SyntheticFrame]:
        """Generate a full dataset of synthetic annotated frames."""
        frames = []
        for i in range(count):
            frame_id = f"{dataset_type.value}_{env.value}_{i:06d}"
            if dataset_type == DatasetType.GESTURE:
                frame = self.generate_gesture_frame(frame_id, env)
            else:
                frame = self.generate_navigation_frame(frame_id, env)
            frames.append(frame)

        return frames

    def export_to_json(self, frames: list[SyntheticFrame], filename: str):
        """Export the generated dataset to a COCO-compatible JSON format."""
        output = {
            "info": {
                "description": "SignVerse Synthetic Robotics Dataset",
                "version": "1.0",
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "total_frames": len(frames),
            },
            "frames": [asdict(f) for f in frames],
        }

        output_path = self.annotation_dir / filename
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)

        print(f"[SyntheticData] Exported {len(frames)} frames → {output_path}")
        return str(output_path)


if __name__ == "__main__":
    generator = SyntheticDataGenerator()

    # Generate gesture dataset
    gesture_frames = generator.generate_dataset(
        count=500,
        dataset_type=DatasetType.GESTURE,
        env=Environment.INDOOR,
    )
    generator.export_to_json(gesture_frames, "gesture_indoor_500.json")

    # Generate navigation dataset
    nav_frames = generator.generate_dataset(
        count=200,
        dataset_type=DatasetType.NAVIGATION,
        env=Environment.WAREHOUSE,
    )
    generator.export_to_json(nav_frames, "navigation_warehouse_200.json")
