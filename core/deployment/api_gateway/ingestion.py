import os
import shutil
import redis
from rq import Queue
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Optional
from core.os.utils.logger import setup_logger
from core.os.utils.config import settings
from core.deployment.api_gateway.pipelines import pipeline_store
from core.pipeline import PipelineStateError

logger = setup_logger("Ingestion_Router")

router = APIRouter(prefix="/api/ingest", tags=["Ingestion Pipeline"])

MONOREPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
UPLOAD_DIR = os.path.join(MONOREPO_ROOT, "core", "datasets", "raw_uploads")

# Ensure directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Connect to Redis
redis_conn = redis.Redis(host='localhost', port=6379)
q_ingest = Queue('ingestion', connection=redis_conn)

def fallback_disabled() -> bool:
    return os.environ.get("SIGNVERSE_DISABLE_INGESTION_FALLBACK") == "1"


def create_ingestion_pipeline_job(source_type: str, metadata: dict[str, Any]) -> dict[str, Any]:
    try:
        job = pipeline_store.create_job(
            metadata={
                "source_type": source_type,
                **metadata,
            }
        )
        return job.to_dict()
    except PipelineStateError as exc:
        logger.error(f"Failed to create ingestion pipeline job: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to create pipeline job: {exc}")

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

        queue_job_id = None
        queue_mode = "redis"

        # Enqueue video frame extraction job on RQ
        try:
            job = q_ingest.enqueue('worker.process_video_job', file_path)
            queue_job_id = job.id
        except Exception as e:
            if fallback_disabled():
                queue_job_id = "fallback_disabled"
                queue_mode = "fallback_disabled"
                pipeline_job = create_ingestion_pipeline_job(
                    "video",
                    {
                        "filename": file.filename,
                        "path": file_path,
                        "queue_job_id": queue_job_id,
                        "queue_mode": queue_mode,
                    },
                )
                return {
                    "status": "success",
                    "filename": file.filename,
                    "path": file_path,
                    "job_id": queue_job_id,
                    "pipeline_job_id": pipeline_job["job_id"],
                    "pipeline_job": pipeline_job,
                }
            logger.warning(f"Failed to enqueue to RQ (Redis offline?): {e}. Falling back to background thread...")
            queue_job_id = "fallback_thread_job"
            queue_mode = "fallback_thread"
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

        pipeline_job = create_ingestion_pipeline_job(
            "video",
            {
                "filename": file.filename,
                "path": file_path,
                "queue_job_id": queue_job_id,
                "queue_mode": queue_mode,
            },
        )

        return {
            "status": "success",
            "filename": file.filename,
            "path": file_path,
            "job_id": queue_job_id,
            "pipeline_job_id": pipeline_job["job_id"],
            "pipeline_job": pipeline_job,
        }
    except Exception as e:
        logger.error(f"Failed to save video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/youtube")
async def ingest_youtube(req: YouTubeRequest):
    if not req.url or ("youtube.com" not in req.url and "youtu.be" not in req.url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    logger.info(f"Queued YouTube URL for ingestion: {req.url}")

    queue_job_id = None
    queue_mode = "redis"

    try:
        # Enqueue youtube download job on RQ
        job = q_ingest.enqueue('worker.process_youtube_job', req.url)
        queue_job_id = job.id
        pipeline_job = create_ingestion_pipeline_job(
            "youtube",
            {
                "url": req.url,
                "queue_job_id": queue_job_id,
                "queue_mode": queue_mode,
            },
        )
        return {
            "status": "success", 
            "message": "YouTube URL queued for processing", 
            "url": req.url,
            "job_id": queue_job_id,
            "pipeline_job_id": pipeline_job["job_id"],
            "pipeline_job": pipeline_job,
        }
    except Exception as e:
        if fallback_disabled():
            queue_job_id = "fallback_disabled"
            queue_mode = "fallback_disabled"
            pipeline_job = create_ingestion_pipeline_job(
                "youtube",
                {
                    "url": req.url,
                    "queue_job_id": queue_job_id,
                    "queue_mode": queue_mode,
                },
            )
            return {
                "status": "success",
                "message": "YouTube URL queued for processing",
                "url": req.url,
                "job_id": queue_job_id,
                "pipeline_job_id": pipeline_job["job_id"],
                "pipeline_job": pipeline_job,
            }
        logger.warning(f"Failed to enqueue to RQ (Redis offline?): {e}. Falling back to background thread...")
        queue_job_id = "fallback_thread_job"
        queue_mode = "fallback_thread"
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

            pipeline_job = create_ingestion_pipeline_job(
                "youtube",
                {
                    "url": req.url,
                    "queue_job_id": queue_job_id,
                    "queue_mode": queue_mode,
                },
            )

            return {
                "status": "success", 
                "message": "YouTube URL queued for processing", 
                "url": req.url,
                "job_id": queue_job_id,
                "pipeline_job_id": pipeline_job["job_id"],
                "pipeline_job": pipeline_job,
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

        queue_job_id = None
        queue_mode = "redis"

        # Enqueue image frame perception job on RQ
        try:
            q_percept = Queue('perception', connection=redis_conn)
            job = q_percept.enqueue('worker.process_frame_job', file_path, 0, 1, file_path)
            queue_job_id = job.id
        except Exception as e:
            if fallback_disabled():
                queue_job_id = "fallback_disabled"
                queue_mode = "fallback_disabled"
                pipeline_job = create_ingestion_pipeline_job(
                    "image",
                    {
                        "filename": file.filename,
                        "path": file_path,
                        "queue_job_id": queue_job_id,
                        "queue_mode": queue_mode,
                    },
                )
                return {
                    "status": "success",
                    "filename": file.filename,
                    "path": file_path,
                    "job_id": queue_job_id,
                    "pipeline_job_id": pipeline_job["job_id"],
                    "pipeline_job": pipeline_job,
                }
            logger.warning(f"Failed to enqueue image to RQ (Redis offline?): {e}. Falling back to background thread...")
            queue_job_id = "fallback_thread_job"
            queue_mode = "fallback_thread"
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

        pipeline_job = create_ingestion_pipeline_job(
            "image",
            {
                "filename": file.filename,
                "path": file_path,
                "queue_job_id": queue_job_id,
                "queue_mode": queue_mode,
            },
        )

        return {
            "status": "success",
            "filename": file.filename,
            "path": file_path,
            "job_id": queue_job_id,
            "pipeline_job_id": pipeline_job["job_id"],
            "pipeline_job": pipeline_job,
        }
    except Exception as e:
        logger.error(f"Failed to save image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webcam")
async def handle_webcam_signal(req: WebRTCRequest):
    logger.info(f"Webcam stream requested action: {req.action}")
    return {"status": "success", "message": f"Webcam stream {req.action} acknowledged"}
