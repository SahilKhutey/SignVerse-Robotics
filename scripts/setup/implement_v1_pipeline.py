import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. Ingestion Service - Video Processor
write_file("services/ingestion-service/video_processor.py", """import cv2
import os

def extract_frames(video_path, output_dir="frames"):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    cap = cv2.VideoCapture(video_path)
    frame_count = 0
    frame_paths = []
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_path = os.path.join(output_dir, f"frame_{frame_count:04d}.jpg")
        cv2.imwrite(frame_path, frame)
        frame_paths.append(frame_path)
        frame_count += 1
        
    cap.release()
    return frame_paths
""")

write_file("services/ingestion-service/worker.py", """import redis
from rq import Queue
from video_processor import extract_frames

redis_conn = redis.Redis(host='localhost', port=6379)
q = Queue('perception', connection=redis_conn)

def process_video_job(video_path):
    print(f"Extracting frames for {video_path}...")
    frame_paths = extract_frames(video_path)
    print(f"Extracted {len(frame_paths)} frames. Queuing to perception...")
    
    # Enqueue frames for perception service
    for i, frame_path in enumerate(frame_paths):
        q.enqueue('worker.process_frame_job', frame_path, i, len(frame_paths), video_path)
""")

# 2. Perception Engine - MediaPipe
write_file("services/perception-service/pose/mediapipe_fullbody.py", """import cv2
import mediapipe as mp

mp_holistic = mp.solutions.holistic
holistic_model = mp_holistic.Holistic(
    static_image_mode=True,
    model_complexity=2,
    enable_segmentation=False,
    refine_face_landmarks=True
)

def extract_fullbody(frame_path):
    image = cv2.imread(frame_path)
    if image is None:
        return None
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = holistic_model.process(image_rgb)
    
    pose = []
    if results.pose_landmarks:
        for lm in results.pose_landmarks.landmark:
            pose.append({"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility})
            
    left_hand = []
    if results.left_hand_landmarks:
        for lm in results.left_hand_landmarks.landmark:
            left_hand.append({"x": lm.x, "y": lm.y, "z": lm.z})
            
    right_hand = []
    if results.right_hand_landmarks:
        for lm in results.right_hand_landmarks.landmark:
            right_hand.append({"x": lm.x, "y": lm.y, "z": lm.z})
            
    face = []
    if results.face_landmarks:
        for lm in results.face_landmarks.landmark:
            face.append({"x": lm.x, "y": lm.y, "z": lm.z})
            
    return {
        "pose": pose,
        "left_hand": left_hand,
        "right_hand": right_hand,
        "face": face
    }
""")

write_file("services/perception-service/worker.py", """import redis
from rq import Queue
from pose.mediapipe_fullbody import extract_fullbody
import json

redis_conn = redis.Redis(host='localhost', port=6379)
q_fusion = Queue('fusion', connection=redis_conn)

def process_frame_job(frame_path, frame_index, total_frames, video_id):
    print(f"Processing frame {frame_index}/{total_frames} for {video_id}...")
    landmarks = extract_fullbody(frame_path)
    
    if landmarks:
        frame_data = {
            "video_id": video_id,
            "frame_index": frame_index,
            "landmarks": landmarks
        }
        # Send to fusion queue for smoothing/storage
        q_fusion.enqueue('worker.process_fusion_job', json.dumps(frame_data))
""")

# 3. Motion Fusion & Storage
write_file("services/motion-fusion-service/smoothing/kalman_filter.py", """from filterpy.kalman import KalmanFilter
import numpy as np

class JointKalmanFilter:
    def __init__(self):
        self.kf = KalmanFilter(dim_x=4, dim_z=2)
        # State: [x, y, vx, vy]
        self.kf.x = np.array([0., 0., 0., 0.])
        self.kf.F = np.array([[1., 0., 1., 0.],
                              [0., 1., 0., 1.],
                              [0., 0., 1., 0.],
                              [0., 0., 0., 1.]])
        self.kf.H = np.array([[1., 0., 0., 0.],
                              [0., 1., 0., 0.]])
        self.kf.P *= 1000.
        self.kf.R = np.array([[5., 0.],
                              [0., 5.]])
        self.kf.Q = np.eye(4) * 0.1
        self.initialized = False

    def update(self, z):
        if not self.initialized:
            self.kf.x = np.array([z[0], z[1], 0., 0.])
            self.initialized = True
        else:
            self.kf.predict()
            self.kf.update(z)
        return self.kf.x[0], self.kf.x[1]
""")

write_file("services/motion-fusion-service/worker.py", """import redis
from rq import Queue
import json
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from smoothing.kalman_filter import JointKalmanFilter

client = AsyncIOMotorClient("mongodb://localhost:27017/")
db = client["signverse"]
collection = db["motions"]

def process_fusion_job_sync(frame_data_json):
    asyncio.run(process_fusion_job_async(frame_data_json))

async def process_fusion_job_async(frame_data_json):
    frame_data = json.loads(frame_data_json)
    
    # In a full implementation, we'd maintain Kalman filters per joint across frames here.
    # For MVP, we pass through the landmarks to storage.
    
    # Upsert the frame into a motion sequence document
    await collection.update_one(
        {"video_id": frame_data["video_id"]},
        {"$push": {"frames": {
            "frame_index": frame_data["frame_index"],
            "landmarks": frame_data["landmarks"]
        }}},
        upsert=True
    )
    print(f"Stored frame {frame_data['frame_index']} for {frame_data['video_id']}")
""")

# 4. API Gateway
write_file("services/api-gateway/app/websockets.py", """from fastapi import WebSocket, APIRouter
import asyncio
import json

router = APIRouter()

active_connections = []

@router.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            # We can listen to a Redis PubSub channel here to broadcast new frames
            data = await websocket.receive_text()
            # Echo for testing
            await websocket.send_text(f"Message text was: {data}")
    except Exception as e:
        print(f"WebSocket closed: {e}")
    finally:
        active_connections.remove(websocket)

async def broadcast_frame(frame_data: dict):
    msg = json.dumps(frame_data)
    for conn in active_connections:
        await conn.send_text(msg)
""")

write_file("services/api-gateway/app/main.py", """from fastapi import FastAPI, UploadFile, File
import shutil
import redis
from rq import Queue
import os
from websockets import router as ws_router

app = FastAPI(title="Sign-Verse API Gateway")
app.include_router(ws_router)

redis_conn = redis.Redis(host='localhost', port=6379)
q_ingestion = Queue('ingestion', connection=redis_conn)

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Trigger ingestion worker
    q_ingestion.enqueue('worker.process_video_job', file_path)
    
    return {"status": "Video uploaded and queued for processing", "file_path": file_path}
""")

# 5. Frontend Dashboard Stubs
write_file("apps/dashboard-web/src/three/Viewer.tsx", """import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export default function Viewer() {
    const [points, setPoints] = useState<any[]>([]);

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8000/ws/stream');
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.landmarks && data.landmarks.pose) {
                setPoints(data.landmarks.pose);
            }
        };
        return () => ws.close();
    }, []);

    return (
        <div style={{ height: '100vh', width: '100vw', backgroundColor: '#111' }}>
            <Canvas camera={{ position: [0, 1, 3], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <OrbitControls />
                {points.map((pt, i) => (
                    <mesh key={i} position={[(pt.x - 0.5) * 2, -(pt.y - 0.5) * 2, -pt.z * 2]}>
                        <sphereGeometry args={[0.02, 16, 16]} />
                        <meshStandardMaterial color="#00ffaa" />
                    </mesh>
                ))}
            </Canvas>
        </div>
    );
}
""")

print("V0/V1 Core Pipeline implementations written.")
