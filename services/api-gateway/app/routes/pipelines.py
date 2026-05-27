from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "../../../orchestration-service"))
from orchestration.dag_pipeline import execute_pipeline
from orchestration.presets import PIPELINE_PRESETS

router = APIRouter()

class PipelineRequest(BaseModel):
    video_path: str
    preset: str = "high_quality"

@router.post("/pipelines/run")
async def run_pipeline(req: PipelineRequest):
    if req.preset not in PIPELINE_PRESETS:
        raise HTTPException(status_code=400, detail="Invalid preset")
        
    if not os.path.exists(req.video_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    job_id = execute_pipeline(req.video_path, req.preset)
    return {"status": "started", "job_id": job_id, "preset": req.preset}
