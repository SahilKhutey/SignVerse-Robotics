import os
import json
import math
import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from core.os.utils.logger import setup_logger

logger = setup_logger("Dataset_Router")

router = APIRouter(prefix="/api/datasets", tags=["Dataset Management"])

MONOREPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW_UPLOAD_DIR = os.path.join(MONOREPO_ROOT, "core", "datasets", "raw_uploads")
PROCESSED_DIR = os.path.join(MONOREPO_ROOT, "core", "datasets", "processed")

os.makedirs(RAW_UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

def format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"

def pre_populate_processed():
    coffee_path = os.path.join(PROCESSED_DIR, "coffee_pour_kinematics.json")
    if not os.path.exists(coffee_path):
        frames = []
        for i in range(1, 101):
            t = i / 100.0
            trans_x = 0.1 + math.sin(t * math.pi) * 0.05
            trans_y = 0.2 + math.cos(t * math.pi) * 0.05
            trans_z = 0.3 - t * 0.1
            j0 = 45.0 + math.sin(t * math.pi) * 15.0
            j1 = 90.0 - math.cos(t * math.pi) * 10.0
            j2 = -30.0 + t * 20.0
            frames.append({
                "frame": i,
                "translation": [trans_x, trans_y, trans_z],
                "joints": {"J0": j0, "J1": j1, "J2": j2}
            })
        with open(coffee_path, "w") as f:
            json.dump(frames, f, indent=2)
            
    door_path = os.path.join(PROCESSED_DIR, "door_open_trajectory.json")
    if not os.path.exists(door_path):
        frames_door = []
        for i in range(1, 121):
            t = i / 120.0
            trans_x = 0.15 + t * 0.05
            trans_y = 0.25 - math.sin(t * math.pi) * 0.02
            trans_z = 0.35
            j0 = 35.0 + t * 25.0
            j1 = 65.0 + math.sin(t * math.pi) * 15.0
            j2 = 95.0 - t * 10.0
            frames_door.append({
                "frame": i,
                "translation": [trans_x, trans_y, trans_z],
                "joints": {"J0": j0, "J1": j1, "J2": j2}
            })
        with open(door_path, "w") as f:
            json.dump(frames_door, f, indent=2)

# Ensure datasets exist on import
pre_populate_processed()

class ExportPayload(BaseModel):
    filename: str
    format: str

@router.get("/raw")
async def get_raw_datasets():
    if not os.path.exists(RAW_UPLOAD_DIR):
        return {"status": "success", "datasets": []}
        
    datasets = []
    try:
        for filename in os.listdir(RAW_UPLOAD_DIR):
            filepath = os.path.join(RAW_UPLOAD_DIR, filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                datasets.append({
                    "id": filename,
                    "name": filename,
                    "type": "Raw Video",
                    "size": format_size(stat.st_size),
                    "created_at": datetime.datetime.fromtimestamp(stat.st_ctime).strftime("%Y-%m-%d %H:%M:%S"),
                    "status": "Ready for Processing"
                })
        return {"status": "success", "datasets": datasets}
    except Exception as e:
        logger.error(f"Error reading raw datasets: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/processed")
async def get_processed_datasets():
    if not os.path.exists(PROCESSED_DIR):
        return {"status": "success", "datasets": []}
        
    datasets = []
    try:
        for filename in os.listdir(PROCESSED_DIR):
            filepath = os.path.join(PROCESSED_DIR, filename)
            if os.path.isfile(filepath) and filename.endswith(".json"):
                stat = os.stat(filepath)
                datasets.append({
                    "id": filename,
                    "name": filename,
                    "type": "Universal Motion",
                    "size": format_size(stat.st_size),
                    "created_at": datetime.datetime.fromtimestamp(stat.st_ctime).strftime("%Y-%m-%d %H:%M:%S"),
                    "status": "Ready for Export"
                })
        return {"status": "success", "datasets": datasets}
    except Exception as e:
        logger.error(f"Error reading processed datasets: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export")
async def export_dataset(payload: ExportPayload):
    input_path = os.path.join(PROCESSED_DIR, payload.filename)
    if not os.path.exists(input_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        with open(input_path, "r") as f:
            kinematics_data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {e}")
        
    # We want to call process_export_job from services/export-service/worker.py
    try:
        import sys
        import importlib.util
        export_service_dir = os.path.join(MONOREPO_ROOT, "services", "export-service")
        spec_worker = importlib.util.spec_from_file_location(
            "export_worker", 
            os.path.join(export_service_dir, "worker.py")
        )
        export_worker = importlib.util.module_from_spec(spec_worker)
        sys.path.insert(0, export_service_dir)
        spec_worker.loader.exec_module(export_worker)
        sys.path.pop(0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load export service worker: {e}")
        
    # Call process_export_job
    job_payload = json.dumps({
        "sequence_id": os.path.splitext(payload.filename)[0],
        "format": payload.format,
        "data": kinematics_data
    })
    
    result = export_worker.process_export_job(job_payload)
    if result.get("status") == "success":
        # Returns success and path to generated file
        return {
            "status": "success",
            "message": f"Successfully exported to {payload.format.upper()}",
            "file_path": result.get("file_path")
        }
    else:
        raise HTTPException(status_code=500, detail=result.get("message", "Export failed"))

@router.delete("/raw/{filename}")
async def delete_raw_dataset(filename: str):
    filepath = os.path.join(RAW_UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        os.remove(filepath)
        logger.info(f"Deleted raw dataset: {filename}")
        return {"status": "success", "message": f"Deleted {filename}"}
    except Exception as e:
        logger.error(f"Failed to delete {filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")
