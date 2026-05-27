from pydantic import BaseModel

class SemanticAction(BaseModel):
    action: str
    start_frame: int
    end_frame: int
