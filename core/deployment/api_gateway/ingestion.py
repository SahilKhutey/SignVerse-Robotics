import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from core.os.utils.logger import setup_logger
from core.os.utils.config import settings

logger = setup_logger("Ingestion_Router")

router = APIRouter(prefix="/api/ingest", tags=["Ingestion Pipeline"])

# Using absolute or relative path for datasets
UPLOAD_DIR = os.path.join(os.getcwd(), "core", "datasets", "raw_uploads")

# Ensure directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

class YouTubeRequest(BaseModel):
    url: str

class WebRTCRequest(BaseModel):
    action: str

@router.post("/video")
async def upload_video(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Successfully ingested video: {file.filename}")
        return {"status": "success", "filename": file.filename, "path": file_path}
    except Exception as e:
        logger.error(f"Failed to save video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/youtube")
async def ingest_youtube(req: YouTubeRequest):
    if not req.url or "youtube.com" not in req.url and "youtu.be" not in req.url:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    logger.info(f"Queued YouTube URL for ingestion: {req.url}")
    # Here we would normally trigger yt-dlp asynchronously
    return {"status": "success", "message": "YouTube URL queued for processing", "url": req.url}

@router.post("/webcam")
async def handle_webcam_signal(req: WebRTCRequest):
    logger.info(f"Webcam stream requested action: {req.action}")
    return {"status": "success", "message": f"Webcam stream {req.action} acknowledged"}
