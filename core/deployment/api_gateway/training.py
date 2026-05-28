import os
import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List
from core.os.utils.logger import setup_logger

logger = setup_logger("Training_Router")

router = APIRouter(prefix="/api/training", tags=["Intelligence & Training"])

# Mock state for training sessions
MOCK_RUNS = {
    "run_001": {
        "id": "run_001",
        "name": "Unitree_H1_Walk_PPO",
        "algorithm": "PPO",
        "status": "Running",
        "epoch": 1450,
        "total_epochs": 5000,
        "reward": 45.2,
        "actor_loss": 0.041,
        "critic_loss": 0.125
    },
    "run_002": {
        "id": "run_002",
        "name": "UR5e_Grasp_IL",
        "algorithm": "Behavior Cloning",
        "status": "Completed",
        "epoch": 2000,
        "total_epochs": 2000,
        "reward": 98.1,
        "actor_loss": 0.002,
        "critic_loss": 0.005
    }
}

class ControlAction(BaseModel):
    action: str  # "stop", "checkpoint"

@router.get("/runs")
async def get_runs():
    # Simulate slight fluctuation in metrics for running sessions
    for r in MOCK_RUNS.values():
        if r["status"] == "Running":
            r["epoch"] += random.randint(1, 10)
            r["reward"] += random.uniform(-0.5, 1.2)
            r["actor_loss"] *= random.uniform(0.95, 1.02)
            r["critic_loss"] *= random.uniform(0.98, 1.05)
            
            if r["epoch"] >= r["total_epochs"]:
                r["epoch"] = r["total_epochs"]
                r["status"] = "Completed"

    return {"status": "success", "runs": list(MOCK_RUNS.values())}

@router.post("/runs/{run_id}/control")
async def control_run(run_id: str, action: ControlAction):
    if run_id not in MOCK_RUNS:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = MOCK_RUNS[run_id]
    
    if action.action == "stop":
        run["status"] = "Stopped"
        logger.info(f"Training run {run_id} manually stopped.")
        return {"status": "success", "message": f"Run {run_id} stopped."}
    
    elif action.action == "checkpoint":
        logger.info(f"Checkpoint saved for {run_id} at epoch {run['epoch']}.")
        return {"status": "success", "message": f"Checkpoint saved at epoch {run['epoch']}."}
    
    raise HTTPException(status_code=400, detail="Invalid action")
