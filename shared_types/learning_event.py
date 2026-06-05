from typing import Literal, Dict
from pydantic import BaseModel, field_validator

class LearningEvent(BaseModel):
    type: Literal["update_complete", "checkpoint_saved", "forgetting_detected", "lr_adjusted"]
    step: int
    loss: float
    val_accuracy: float
    per_task_accuracy: Dict[str, float]
    learning_rate: float
    replay_ratio: float
    timestamp_ms: int

    @field_validator("val_accuracy")
    @classmethod
    def check_val_accuracy(cls, v):
        if not (0.0 <= v <= 1.0):
            raise ValueError("val_accuracy must be between 0 and 1")
        return v
