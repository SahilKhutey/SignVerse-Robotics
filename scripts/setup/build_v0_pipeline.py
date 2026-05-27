import os
import json

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# Update requirements to include RQ
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
""")

# STEP 3 - API Gateway Main
write_file("services/api-gateway/app/main.py", """from fastapi import FastAPI
from app.routes.upload import router as upload_router
from app.websocket.stream import router as stream_router

app = FastAPI()

app.include_router(upload_router)
app.include_router(stream_router)

@app.get("/")
async def root():
    return {
        "platform": "Sign-Verse Robotics"
    }
""")

# STEP 4 - Video Upload System
write_file("services/api-gateway/app/routes/upload.py", """from fastapi import APIRouter, UploadFile, File
import uuid
import shutil
import os

router = APIRouter()

UPLOAD_DIR = "storage/videos"

os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload/video")
async def upload_video(
    file: UploadFile = File(...)
):

    video_id = str(uuid.uuid4())

    path = f"{UPLOAD_DIR}/{video_id}.mp4"

    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "video_id": video_id,
        "path": path
    }
""")

# STEP 5 - Frame Extraction Engine
write_file("services/ingestion-service/app/ffmpeg/frame_extractor.py", """import cv2
import os

def extract_frames(
    video_path,
    output_dir
):

    os.makedirs(output_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)

    frame_index = 0

    while True:

        success, frame = cap.read()

        if not success:
            break

        frame_path = f"{output_dir}/{frame_index:06d}.jpg"

        cv2.imwrite(frame_path, frame)

        frame_index += 1

    cap.release()

    return frame_index
""")

# STEP 6 - MediaPipe Pose Pipeline
write_file("services/perception-service/pose/mediapipe_pose.py", """import mediapipe as mp
import cv2

mp_pose = mp.solutions.pose

pose = mp_pose.Pose()

def detect_pose(frame_path):

    frame = cv2.imread(frame_path)

    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    results = pose.process(rgb)

    output = []

    if results.pose_landmarks:

        for idx, landmark in enumerate(
            results.pose_landmarks.landmark
        ):

            output.append({
                "joint_id": idx,
                "x": landmark.x,
                "y": landmark.y,
                "z": landmark.z,
                "visibility": landmark.visibility
            })

    return output
""")

# STEP 7 - Skeleton Overlay Engine
write_file("services/overlay-service/overlays/skeleton_overlay.py", """import cv2

def draw_skeleton(
    frame,
    landmarks
):

    for point in landmarks:

        x = int(
            point["x"] * frame.shape[1]
        )

        y = int(
            point["y"] * frame.shape[0]
        )

        cv2.circle(
            frame,
            (x, y),
            4,
            (0,255,0),
            -1
        )

    return frame
""")

# STEP 8 - Motion JSON Storage
write_file("storage/mongodb.py", """from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(
    "mongodb://localhost:27017"
)

db = client.signverse
""")

# STEP 9 - WebSocket Streaming
write_file("services/api-gateway/app/websocket/stream.py", """from fastapi import APIRouter, WebSocket

router = APIRouter()

clients = []

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket
):

    await websocket.accept()

    clients.append(websocket)

    try:

        while True:

            data = await websocket.receive_text()

            await websocket.send_text(data)

    except:
        clients.remove(websocket)
""")

print("V0 Pipeline files successfully written.")
