from pydantic import BaseModel
from typing import Dict, Any, Optional

class InputFrame(BaseModel):
    id: str
    timestamp: float
    source: str
    frame_data: str  # Base64 encoded for MVP, eventually WebRTC/binary
    metadata: Dict[str, Any]
    requested_models: Optional[list[str]] = None
