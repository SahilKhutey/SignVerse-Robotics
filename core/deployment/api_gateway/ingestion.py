import os
import shutil
import redis
from rq import Queue
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from core.os.utils.logger import setup_logger
from core.os.utils.config import settings

logger = setup_logger("Ingestion_Router")

router = APIRouter(prefix="/api/ingest", tags=["Ingestion Pipeline"])

MONOREPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
UPLOAD_DIR = os.path.join(MONOREPO_ROOT, "core", "datasets", "raw_uploads")

# Ensure directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Connect to Redis
redis_conn = redis.Redis(host='localhost', port=6379)
q_ingest = Queue('ingestion', connection=redis_conn)

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
        
        # Enqueue video frame extraction job on RQ
        try:
            q_ingest.enqueue('worker.process_video_job', file_path)
        except Exception as e:
            logger.warning(f"Failed to enqueue to RQ (Redis offline?): {e}. Falling back to background thread...")
            # Fallback: run the worker job directly in a background thread
            import threading
            try:
                import sys
                import importlib.util
                ingest_service_dir = os.path.join(MONOREPO_ROOT, "services", "ingestion-service")
                spec_worker = importlib.util.spec_from_file_location(
                    "ingest_worker", 
                    os.path.join(ingest_service_dir, "worker.py")
                )
                ingest_worker = importlib.util.module_from_spec(spec_worker)
                sys.path.insert(0, ingest_service_dir)
                spec_worker.loader.exec_module(ingest_worker)
                sys.path.pop(0)
                
                t = threading.Thread(target=ingest_worker.process_video_job, args=(file_path,), daemon=True)
                t.start()
            except Exception as thread_err:
                logger.error(f"Fallback thread launch failed: {thread_err}")
            
        return {"status": "success", "filename": file.filename, "path": file_path}
    except Exception as e:
        logger.error(f"Failed to save video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/youtube")
async def ingest_youtube(req: YouTubeRequest):
    if not req.url or ("youtube.com" not in req.url and "youtu.be" not in req.url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    logger.info(f"Queued YouTube URL for ingestion: {req.url}")
    
    try:
        # Enqueue youtube download job on RQ
        job = q_ingest.enqueue('worker.process_youtube_job', req.url)
        return {
            "status": "success", 
            "message": "YouTube URL queued for processing", 
            "url": req.url,
            "job_id": job.id
        }
    except Exception as e:
        logger.warning(f"Failed to enqueue to RQ (Redis offline?): {e}. Falling back to background thread...")
        # Fallback: run the worker job directly in a background thread
        import threading
        try:
            import sys
            import importlib.util
            ingest_service_dir = os.path.join(MONOREPO_ROOT, "services", "ingestion-service")
            spec_worker = importlib.util.spec_from_file_location(
                "ingest_worker", 
                os.path.join(ingest_service_dir, "worker.py")
            )
            ingest_worker = importlib.util.module_from_spec(spec_worker)
            sys.path.insert(0, ingest_service_dir)
            spec_worker.loader.exec_module(ingest_worker)
            sys.path.pop(0)
            
            t = threading.Thread(target=ingest_worker.process_youtube_job, args=(req.url,), daemon=True)
            t.start()
            
            return {
                "status": "success", 
                "message": "YouTube URL queued for processing", 
                "url": req.url,
                "job_id": "fallback_thread_job"
            }
        except Exception as thread_err:
            logger.error(f"Fallback thread launch failed: {thread_err}")
            raise HTTPException(status_code=500, detail=f"Failed to queue YouTube download: {e}")

@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
        
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        logger.info(f"Successfully ingested image: {file.filename}")
        
        # Enqueue image frame perception job on RQ
        try:
            q_percept = Queue('perception', connection=redis_conn)
            q_percept.enqueue('worker.process_frame_job', file_path, 0, 1, file_path)
        except Exception as e:
            logger.warning(f"Failed to enqueue image to RQ (Redis offline?): {e}. Falling back to background thread...")
            # Fallback: run the worker job directly in a background thread
            import threading
            try:
                import sys
                import importlib.util
                percept_service_dir = os.path.join(MONOREPO_ROOT, "services", "perception-service")
                spec_worker = importlib.util.spec_from_file_location(
                    "percept_worker", 
                    os.path.join(percept_service_dir, "worker.py")
                )
                percept_worker = importlib.util.module_from_spec(spec_worker)
                sys.path.insert(0, percept_service_dir)
                spec_worker.loader.exec_module(percept_worker)
                sys.path.pop(0)
                
                t = threading.Thread(target=percept_worker.process_frame_job, args=(file_path, 0, 1, file_path), daemon=True)
                t.start()
            except Exception as thread_err:
                logger.error(f"Fallback thread launch failed: {thread_err}")
                
        return {"status": "success", "filename": file.filename, "path": file_path}
    except Exception as e:
        logger.error(f"Failed to save image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webcam")
async def handle_webcam_signal(req: WebRTCRequest):
    logger.info(f"Webcam stream requested action: {req.action}")
    return {"status": "success", "message": f"Webcam stream {req.action} acknowledged"}
