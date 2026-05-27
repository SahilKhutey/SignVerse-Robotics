from pydantic import BaseModel
from typing import Dict, Any, List, Optional

class DatasetMetadata(BaseModel):
    id: str
    filename: str
    tags: List[str]
    source: str  # e.g., 'simulation', 'physical_robot', 'manual_upload'
    robotics_context: Optional[Dict[str, Any]]
    storage_uri: str
    version: str = "v1.0"
