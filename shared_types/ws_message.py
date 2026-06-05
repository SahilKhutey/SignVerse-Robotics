from typing import Literal, Union, List, Annotated
from pydantic import BaseModel, Field, RootModel
from shared_types.telemetry import TelemetryFrame, PoseLandmark

class LandmarkData(BaseModel):
    landmarks: List[PoseLandmark]

class TelemetryMessage(BaseModel):
    type: Literal["telemetry"]
    data: TelemetryFrame

class LandmarkMessage(BaseModel):
    type: Literal["landmark"]
    data: LandmarkData

class ErrorMessage(BaseModel):
    type: Literal["error"]
    message: str

class PongMessage(BaseModel):
    type: Literal["pong"]
    ts: int

class RttMessage(BaseModel):
    type: Literal["rtt"]
    rtt_ms: int

# Discriminated union wrapper
WSMessage = RootModel[Annotated[
    Union[TelemetryMessage, LandmarkMessage, ErrorMessage, PongMessage, RttMessage],
    Field(discriminator="type")
]]
