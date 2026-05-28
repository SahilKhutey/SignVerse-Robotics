import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List
from core.os.utils.logger import setup_logger

logger = setup_logger("Retargeting_Router")

router = APIRouter(prefix="/api/retarget", tags=["Kinematic Retargeting"])

# Mock Database for Robot Profiles and Saved Maps
ROBOT_PROFILES = {
    "ur5e": {
        "id": "ur5e",
        "name": "UR5e Robotic Arm",
        "type": "Manipulator",
        "joints": ["shoulder_pan", "shoulder_lift", "elbow", "wrist_1", "wrist_2", "wrist_3", "gripper"]
    },
    "unitree_h1": {
        "id": "unitree_h1",
        "name": "Unitree H1 Humanoid",
        "type": "Humanoid",
        "joints": ["L_Hip_Yaw", "L_Hip_Roll", "L_Hip_Pitch", "L_Knee", "L_Ankle", "R_Hip_Yaw", "R_Hip_Roll", "R_Hip_Pitch", "R_Knee", "R_Ankle", "Torso", "L_Shoulder_Pitch", "L_Shoulder_Roll", "L_Shoulder_Yaw", "L_Elbow", "R_Shoulder_Pitch", "R_Shoulder_Roll", "R_Shoulder_Yaw", "R_Elbow"]
    }
}

class MappingPayload(BaseModel):
    robot_id: str
    mappings: Dict[str, str]  # { human_joint: robot_joint }

@router.get("/robots")
async def get_robots():
    return {"status": "success", "robots": list(ROBOT_PROFILES.values())}

@router.post("/map")
async def save_mapping(payload: MappingPayload):
    if payload.robot_id not in ROBOT_PROFILES:
        raise HTTPException(status_code=404, detail="Robot profile not found")
    
    # In production, this would save to a JSON file or SQLite Database in Layer 8
    logger.info(f"Saved Retargeting Map for {payload.robot_id}: {json.dumps(payload.mappings)}")
    
    return {
        "status": "success",
        "message": f"Successfully mapped {len(payload.mappings)} joints to {ROBOT_PROFILES[payload.robot_id]['name']}"
    }
