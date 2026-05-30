"""
Training API Router
====================
Replaces the mock data with live stats from the TrainingOrchestrator
that is running inside the kernel (accessed via gateway_state).
"""

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
      is_training, total_train_runs, new_weights_ready,
      ema_train_loss, ema_val_loss, best_checkpoint, recorder (dict)
    """
    kernel = gateway_state.kernel
    if kernel is None:
        return {"status": "kernel_offline", "stats": {}}

    try:
        stats = kernel.orchestrator.stats
        return {"status": "ok", "stats": stats}
    except AttributeError:
        return {"status": "ok", "stats": {"error": "orchestrator not attached"}}


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
