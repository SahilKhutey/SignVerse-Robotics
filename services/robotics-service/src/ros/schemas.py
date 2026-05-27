from pydantic import BaseModel
from typing import Any

class ROSMessage(BaseModel):
    topic: str
    timestamp: float
    payload: Any
