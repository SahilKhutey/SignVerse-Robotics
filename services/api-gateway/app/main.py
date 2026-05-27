from fastapi import FastAPI, UploadFile, File, Form, HTTPException
import shutil
import redis
from rq import Queue
import os
from pydantic import BaseModel
from websockets import router as ws_router
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "../../../ingestion-service"))
from youtube_downloader import download_youtube_video
from image_processor import process_static_image

app = FastAPI(title="Sign-Verse Universal API Gateway")
app.include_router(ws_router)

redis_conn = redis.Redis(host='localhost', port=6379)
q_ingestion = Queue('ingestion', connection=redis_conn)
q_perception = Queue('perception', connection=redis_conn)

class YouTubeRequest(BaseModel):
    url: str

@app.post("/upload/video")
async def upload_video(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    q_ingestion.enqueue('worker.process_video_job', file_path)
    return {"status": "Video uploaded and queued", "file_path": file_path}

@app.post("/upload/youtube")
async def upload_youtube(req: YouTubeRequest):
    # Enqueue a special job to download then process
    q_ingestion.enqueue('worker.process_youtube_job', req.url)
    return {"status": "YouTube download queued", "url": req.url}

@app.post("/upload/image")
async def upload_image(file: UploadFile = File(...)):
    file_path = process_static_image(file)
    # Images skip frame extraction and go straight to perception
    q_perception.enqueue('worker.process_frame_job', file_path, 0, 1, file_path)
    return {"status": "Image uploaded and queued", "file_path": file_path}
