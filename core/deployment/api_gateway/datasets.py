import os
import datetime
from fastapi import APIRouter, HTTPException
from core.os.utils.logger import setup_logger

logger = setup_logger("Dataset_Router")

router = APIRouter(prefix="/api/datasets", tags=["Dataset Management"])

RAW_UPLOAD_DIR = os.path.join(os.getcwd(), "core", "datasets", "raw_uploads")

def format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"

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
    # Currently mocked until Perception Engine creates actual HDF5/NPZ/JSON datasets
    mock_datasets = [
        {
            "id": "mock_ds_01",
            "name": "coffee_pour_kinematics.json",
            "type": "Universal Motion",
            "size": "2.4 MB",
            "created_at": "2026-05-28 10:00:00",
            "status": "Ready for Export"
        },
        {
            "id": "mock_ds_02",
            "name": "door_open_trajectory.bvh",
            "type": "BVH Rig",
            "size": "8.1 MB",
            "created_at": "2026-05-27 15:30:00",
            "status": "Exported"
        }
    ]
    return {"status": "success", "datasets": mock_datasets}

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
