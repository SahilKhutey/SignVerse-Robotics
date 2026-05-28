import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from core.os.utils.logger import setup_logger

logger = setup_logger("Timeline_Router")

router = APIRouter(prefix="/api/timeline", tags=["Timeline Annotation"])

class Segment(BaseModel):
    start_frame: int
    end_frame: int
    intent: str

# Mock datastore for segments (in memory for now, to be moved to Layer 8 DB)
MOCK_SEQUENCES = {
    "seq_001": {
        "id": "seq_001",
        "name": "Coffee_Pour_MultiCam.mp4",
        "total_frames": 1000,
        "segments": [
            {"id": "seg_1", "start_frame": 100, "end_frame": 250, "intent": "Grasping Cup"},
            {"id": "seg_2", "start_frame": 300, "end_frame": 450, "intent": "Pouring Liquid"}
        ]
    }
}

@router.get("/sequences")
async def get_sequences():
    # Return available sequences
    seqs = [{"id": k, "name": v["name"], "total_frames": v["total_frames"]} for k, v in MOCK_SEQUENCES.items()]
    return {"status": "success", "sequences": seqs}

@router.get("/sequences/{seq_id}")
async def get_sequence(seq_id: str):
    if seq_id not in MOCK_SEQUENCES:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return {"status": "success", "sequence": MOCK_SEQUENCES[seq_id]}

@router.post("/sequences/{seq_id}/segments")
async def add_segment(seq_id: str, segment: Segment):
    if seq_id not in MOCK_SEQUENCES:
        raise HTTPException(status_code=404, detail="Sequence not found")
    
    if segment.start_frame >= segment.end_frame or segment.start_frame < 0 or segment.end_frame > MOCK_SEQUENCES[seq_id]["total_frames"]:
        raise HTTPException(status_code=400, detail="Invalid frame range")

    new_seg = {
        "id": f"seg_{len(MOCK_SEQUENCES[seq_id]['segments']) + 1}",
        "start_frame": segment.start_frame,
        "end_frame": segment.end_frame,
        "intent": segment.intent
    }
    
    MOCK_SEQUENCES[seq_id]["segments"].append(new_seg)
    logger.info(f"Added segment {new_seg['id']} to sequence {seq_id}")
    
    return {"status": "success", "segment": new_seg}
