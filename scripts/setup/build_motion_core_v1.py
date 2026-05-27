import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# Step 13 - Temporal Frame Engine
write_file("services/motion-fusion-service/timeline/frame_schema.py", """from pydantic import BaseModel
from typing import List

class FrameData(BaseModel):
    frame_index: int
    timestamp: float
    landmarks: List[dict]
""")

write_file("services/motion-fusion-service/timeline/motion_sequence.py", """from pydantic import BaseModel
from typing import List
from .frame_schema import FrameData

class MotionSequence(BaseModel):
    video_id: str
    fps: float
    total_frames: int
    frames: List[FrameData]
""")

# Step 14 - Kalman Filter Motion Smoothing
write_file("services/motion-fusion-service/smoothing/kalman_filter.py", """from filterpy.kalman import KalmanFilter
import numpy as np

class JointKalmanFilter:
    def __init__(self):
        self.kf = KalmanFilter(
            dim_x=4,
            dim_z=2
        )
        self.kf.x = np.array([0., 0., 0., 0.])

    def update(self, x, y):
        measurement = np.array([x, y])
        self.kf.predict()
        self.kf.update(measurement)
        return self.kf.x[0], self.kf.x[1]
""")

# Step 15 - Bone Connection Engine
write_file("services/overlay-service/overlays/bones.py", """BONES = [
    (11, 13),
    (13, 15),
    (12, 14),
    (14, 16),
    (23, 25),
    (25, 27),
    (24, 26),
    (26, 28),
    (11, 12),
    (23, 24),
    (11, 23),
    (12, 24)
]
""")

write_file("services/overlay-service/overlays/skeleton_overlay.py", """import cv2
from .bones import BONES

def draw_skeleton(frame, landmarks):
    for point in landmarks:
        x = int(point["x"] * frame.shape[1])
        y = int(point["y"] * frame.shape[0])
        cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)
    return frame

def draw_bones(frame, landmarks):
    for start, end in BONES:
        if start < len(landmarks) and end < len(landmarks):
            x1 = int(landmarks[start]["x"] * frame.shape[1])
            y1 = int(landmarks[start]["y"] * frame.shape[0])
            x2 = int(landmarks[end]["x"] * frame.shape[1])
            y2 = int(landmarks[end]["y"] * frame.shape[0])
            cv2.line(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
    return frame
""")

# Step 16 - Tracking IDs
write_file("services/motion-fusion-service/tracking/yolo_tracker.py", """from ultralytics import YOLO

model = YOLO('yolov8n.pt')

def track_persons(video_path):
    results = model.track(
        source=video_path,
        persist=True,
        stream=True
    )
    tracking_data = []
    for r in results:
        # Extrapolate track_ids and bounding boxes
        frame_tracks = []
        if r.boxes and r.boxes.id is not None:
            for box, track_id in zip(r.boxes, r.boxes.id):
                frame_tracks.append({
                    "track_id": int(track_id),
                    "person_id": f"human_{int(track_id):03d}",
                    "box": box.xyxy[0].tolist()
                })
        tracking_data.append(frame_tracks)
    return tracking_data
""")

# Step 17 & 18 - Full-Body Perception Integration (Pose + Hands + Face)
write_file("services/perception-service/pose/mediapipe_fullbody.py", """import mediapipe as mp
import cv2

mp_pose = mp.solutions.pose
mp_hands = mp.solutions.hands
mp_face = mp.solutions.face_mesh

pose = mp_pose.Pose()
hands = mp_hands.Hands(max_num_hands=2)
face_mesh = mp_face.FaceMesh()

def detect_fullbody(frame_path):
    frame = cv2.imread(frame_path)
    if frame is None:
        return None

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    pose_results = pose.process(rgb)
    hands_results = hands.process(rgb)
    face_results = face_mesh.process(rgb)

    output = {
        "pose": [],
        "hands": [],
        "face": []
    }

    if pose_results.pose_landmarks:
        for idx, lm in enumerate(pose_results.pose_landmarks.landmark):
            output["pose"].append({
                "joint_id": idx,
                "x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility
            })

    if hands_results.multi_hand_landmarks:
        for hand_idx, hand_landmarks in enumerate(hands_results.multi_hand_landmarks):
            # Attempt to determine handedness if available
            label = "unknown"
            if hands_results.multi_handedness:
                label = hands_results.multi_handedness[hand_idx].classification[0].label
            
            hand_data = {"hand": label, "landmarks": []}
            for lm in hand_landmarks.landmark:
                hand_data["landmarks"].append({"x": lm.x, "y": lm.y, "z": lm.z})
            output["hands"].append(hand_data)

    if face_results.multi_face_landmarks:
        for face_landmarks in face_results.multi_face_landmarks:
            for lm in face_landmarks.landmark:
                output["face"].append({"x": lm.x, "y": lm.y, "z": lm.z})

    return output
""")

# Step 19 - Universal Motion Format
write_file("packages/motion-format/schema.py", """from pydantic import BaseModel
from typing import List, Dict, Optional

class Vector3D(BaseModel):
    x: float
    y: float
    z: float = 0.0

class PersonMotion(BaseModel):
    track_id: int
    pose: List[dict]
    hands: List[dict]
    face: List[dict]
    velocity: Dict[str, Vector3D]
    acceleration: Dict[str, Vector3D]

class UniversalFrame(BaseModel):
    frame_index: int
    timestamp: float
    persons: List[PersonMotion]

class UniversalMotion(BaseModel):
    video_id: str
    fps: float
    frames: List[UniversalFrame]
""")

# Step 20 - Motion Vector Engine
write_file("services/motion-fusion-service/fusion/vector_engine.py", """class VectorEngine:
    def __init__(self):
        self.history = {}

    def update_vectors(self, track_id, joint_name, current_x, current_y, dt):
        key = f"{track_id}_{joint_name}"
        
        if key not in self.history:
            self.history[key] = {
                "x": current_x, "y": current_y,
                "vx": 0.0, "vy": 0.0
            }
            return {"x": 0.0, "y": 0.0}, {"x": 0.0, "y": 0.0}

        prev = self.history[key]
        
        if dt > 0:
            vx = (current_x - prev["x"]) / dt
            vy = (current_y - prev["y"]) / dt
            
            ax = (vx - prev["vx"]) / dt
            ay = (vy - prev["vy"]) / dt
        else:
            vx, vy, ax, ay = 0.0, 0.0, 0.0, 0.0

        self.history[key] = {
            "x": current_x, "y": current_y,
            "vx": vx, "vy": vy
        }

        return {"x": vx, "y": vy}, {"x": ax, "y": ay}
""")

# Append ultralytics and filterpy to requirements.txt
write_file("services/api-gateway/requirements.txt", """fastapi
uvicorn
pydantic
python-multipart
websockets
redis
rq
motor
sqlalchemy
asyncpg
minio
opencv-python
numpy
mediapipe
filterpy
ultralytics
""")

print("Sign-Verse Motion Core V1 setup complete.")
