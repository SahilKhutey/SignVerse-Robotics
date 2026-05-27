import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. YouTube Downloader
write_file("services/ingestion-service/youtube_downloader.py", """import yt_dlp
import os
import uuid

def download_youtube_video(url, output_dir="uploads"):
    os.makedirs(output_dir, exist_ok=True)
    video_id = str(uuid.uuid4())
    output_path = os.path.join(output_dir, f"{video_id}.%(ext)s")
    
    ydl_opts = {
        'format': 'bestvideo[height<=720]+bestaudio/best[height<=720]', # Limit to 720p for speed
        'outtmpl': output_path,
        'merge_output_format': 'mp4',
        'quiet': True,
        'no_warnings': True
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Downloading YouTube URL: {url}")
            ydl.download([url])
            
        final_path = os.path.join(output_dir, f"{video_id}.mp4")
        if os.path.exists(final_path):
            return final_path
        else:
            raise Exception("File downloaded but mp4 not found")
            
    except Exception as e:
        print(f"Error downloading YouTube video: {e}")
        return None
""")

# 2. Static Image Processor
write_file("services/ingestion-service/image_processor.py", """import os
import uuid
import shutil

def process_static_image(image_file, output_dir="uploads/images"):
    '''
    Saves an uploaded static image and prepares it for the perception queue.
    image_file is a FastAPI UploadFile object.
    '''
    os.makedirs(output_dir, exist_ok=True)
    image_id = str(uuid.uuid4())
    
    ext = os.path.splitext(image_file.filename)[1]
    if not ext: ext = ".jpg"
    
    file_path = os.path.join(output_dir, f"{image_id}{ext}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image_file.file, buffer)
        
    return file_path
""")

# 3. Gateway Updates
write_file("services/api-gateway/app/main.py", """from fastapi import FastAPI, UploadFile, File, Form, HTTPException
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
""")

# Update ingestion worker to handle the youtube job
write_file("services/ingestion-service/worker.py", """import redis
from rq import Queue
from video_processor import extract_frames
from youtube_downloader import download_youtube_video

redis_conn = redis.Redis(host='localhost', port=6379)
q = Queue('perception', connection=redis_conn)

def process_video_job(video_path):
    print(f"Extracting frames for {video_path}...")
    frame_paths = extract_frames(video_path)
    print(f"Extracted {len(frame_paths)} frames. Queuing to perception...")
    
    for i, frame_path in enumerate(frame_paths):
        q.enqueue('worker.process_frame_job', frame_path, i, len(frame_paths), video_path)

def process_youtube_job(url):
    print(f"Downloading YouTube video: {url}")
    video_path = download_youtube_video(url)
    if video_path:
        process_video_job(video_path)
""")

print("Universal Ingestion Modules implemented.")
