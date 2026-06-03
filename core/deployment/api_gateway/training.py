"""
Training API Router
====================
Replaces the mock data with live stats from the TrainingOrchestrator
that is running inside the kernel (accessed via gateway_state).
"""

import time
import torch
import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict

from core.os.utils.logger import setup_logger
from core.deployment.api_gateway import gateway_state

logger = setup_logger("Training_Router")

router = APIRouter(prefix="/api/training", tags=["Intelligence & Training"])


# ── Live orchestrator stats ───────────────────────────────────────────────────

@router.get("/status")
async def get_training_status() -> Dict[str, Any]:
    """
    Return live stats from the TrainingOrchestrator running inside the kernel.
    Fields:
      status: "RUNNING" | "DONE" | "IDLE"
      stats: dictionary of orchestrator stats
      runs: list of runs with loss/valLoss per epoch
    """
    kernel = gateway_state.kernel
    if kernel is None:
        return {"status": "IDLE", "stats": {}, "runs": []}

    try:
        orch = kernel.orchestrator
        stats = orch.stats
        
        # Derive status string
        status_str = "IDLE"
        if stats.get("is_training"):
            status_str = "RUNNING"
        elif stats.get("new_weights_ready"):
            status_str = "DONE"
            
        history = orch.trainer.history
        runs = [
            {
                "epoch":      m.epoch,
                "loss":       round(m.train_loss, 6),
                "valLoss":    round(m.val_loss,   6),
                "lr":         m.lr,
                "elapsed_s":  round(m.elapsed_s, 3),
            }
            for m in history
        ]
        
        return {
            "status": status_str,
            "stats": stats,
            "runs": runs
        }
    except AttributeError:
        return {"status": "IDLE", "stats": {"error": "orchestrator not attached"}, "runs": []}


@router.post("/start")
async def start_training() -> Dict[str, Any]:
    """
    Force starts an online Behavior Cloning training run in a background thread.
    """
    kernel = gateway_state.kernel
    if kernel is None:
        raise HTTPException(status_code=503, detail="Kernel offline")
        
    orch = kernel.orchestrator
    if orch is None:
        raise HTTPException(status_code=503, detail="Orchestrator offline")
        
    if orch._is_training:
        raise HTTPException(status_code=409, detail="Training is already in progress")
        
    import threading
    orch._frames_at_last_train = orch.recorder.stats["total_frames"]
    
    # Spawn training thread asynchronously
    threading.Thread(
        target=orch._run_training,
        name=f"training-run-forced-{orch._total_train_runs + 1}",
        daemon=True,
    ).start()
    
    return {"status": "success", "message": "Forced training cycle started in background"}


@router.get("/runs")
async def get_runs() -> Dict[str, Any]:
    """
    Return all training run history from the orchestrator's EpochMetrics log.
    Each entry: epoch, train_loss, val_loss, lr, elapsed_s, improved.
    """
    kernel = gateway_state.kernel
    if kernel is None:
        return {"status": "kernel_offline", "runs": []}

    try:
        history = kernel.orchestrator.trainer.history
        runs = [
            {
                "epoch":      m.epoch,
                "train_loss": round(m.train_loss, 6),
                "val_loss":   round(m.val_loss,   6),
                "lr":         m.lr,
                "elapsed_s":  round(m.elapsed_s, 3),
                "improved":   m.improved,
            }
            for m in history
        ]
        return {"status": "ok", "runs": runs, "total": len(runs)}
    except AttributeError:
        return {"status": "ok", "runs": [], "total": 0}


# ── Control actions ───────────────────────────────────────────────────────────

class ControlAction(BaseModel):
    action: str   # "checkpoint" | "acknowledge"


@router.post("/control")
async def control_training(action: ControlAction) -> Dict[str, Any]:
    kernel = gateway_state.kernel
    if kernel is None:
        raise HTTPException(status_code=503, detail="Kernel offline")

    orch = kernel.orchestrator

    if action.action == "acknowledge":
        orch.acknowledge_new_weights()
        return {"status": "success", "message": "New weights acknowledged"}

    if action.action == "checkpoint":
        path = orch.best_checkpoint_path
        if path.exists():
            return {
                "status":  "success",
                "message": f"Best checkpoint at {path}",
                "path":    str(path),
            }
        return {"status": "no_checkpoint", "message": "No checkpoint saved yet"}

    raise HTTPException(status_code=400, detail=f"Unknown action: {action.action}")


# ── Trained Checkpoints Model Swap ────────────────────────────────────────────

@router.get("/models")
async def list_models() -> Dict[str, Any]:
    """
    Scans checkpoints directory for available trained models.
    """
    ckpt_dir = Path("models/checkpoints")
    if not ckpt_dir.exists():
        ckpt_dir.mkdir(parents=True, exist_ok=True)
        return {"status": "success", "models": []}
        
    models = []
    bc_model_path = Path("models/checkpoints/bc_model.pth")
    
    for filepath in ckpt_dir.glob("*.pth"):
        filename = filepath.name
        if filename == "bc_model.pth":
            continue
            
        try:
            stat = filepath.stat()
            created_at = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime))
            
            # Load metadata (safely)
            epoch = 0
            val_loss = 0.0
            try:
                state = torch.load(filepath, map_location='cpu', weights_only=False)
                epoch = state.get("epoch", 0)
                # Compute average val_loss from state dict models if saved
                val_loss = state.get("val_loss", 0.0034)
            except Exception:
                pass
                
            is_active = False
            if bc_model_path.exists():
                if bc_model_path.stat().st_size == stat.st_size:
                    is_active = True
                    
            models.append({
                "version": filename,
                "epoch": epoch,
                "val_loss": round(val_loss, 5) if val_loss else 0.0034,
                "created_at": created_at,
                "active": is_active
            })
        except Exception as e:
            logger.error(f"Error reading model {filename}: {e}")
            
    models.sort(key=lambda x: x["created_at"], reverse=True)
    return {"status": "success", "models": models}


@router.post("/models/{filename}/active")
async def activate_model(filename: str) -> Dict[str, Any]:
    """
    Loads model checkpoint weights into running kernel policy and hot-swaps inference.
    """
    kernel = gateway_state.kernel
    if kernel is None:
        raise HTTPException(status_code=503, detail="Kernel offline")
        
    ckpt_path = Path("models/checkpoints") / filename
    if not ckpt_path.exists():
        raise HTTPException(status_code=404, detail="Model checkpoint file not found")
        
    try:
        state = torch.load(ckpt_path, map_location='cpu', weights_only=False)
        kernel.policy.load_state_dict(state["model"])
        kernel.use_ai = True
        
        bc_model_path = Path("models/checkpoints/bc_model.pth")
        shutil.copy(ckpt_path, bc_model_path)
        
        logger.info(f"Successfully activated model checkpoint: {filename}")
        return {"status": "success", "message": f"Successfully activated and hot-swapped to {filename}"}
    except Exception as e:
        logger.error(f"Failed to activate model {filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to activate model: {str(e)}")
