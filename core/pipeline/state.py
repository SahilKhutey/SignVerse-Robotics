from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class PipelineStage(str, Enum):
    INGESTION = "ingestion"
    PERCEPTION = "perception"
    FUSION = "fusion"
    KINEMATICS = "kinematics"
    SIMULATION = "simulation"
    EXPORT = "export"


class PipelineStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


DEFAULT_PIPELINE_STAGES: tuple[PipelineStage, ...] = (
    PipelineStage.INGESTION,
    PipelineStage.PERCEPTION,
    PipelineStage.FUSION,
    PipelineStage.KINEMATICS,
    PipelineStage.SIMULATION,
    PipelineStage.EXPORT,
)


ALLOWED_STATUS_TRANSITIONS: dict[PipelineStatus, set[PipelineStatus]] = {
    PipelineStatus.QUEUED: {PipelineStatus.PROCESSING, PipelineStatus.CANCELLED},
    PipelineStatus.PROCESSING: {
        PipelineStatus.COMPLETED,
        PipelineStatus.FAILED,
        PipelineStatus.RETRYING,
        PipelineStatus.CANCELLED,
    },
    PipelineStatus.RETRYING: {PipelineStatus.PROCESSING, PipelineStatus.FAILED, PipelineStatus.CANCELLED},
    PipelineStatus.FAILED: {PipelineStatus.RETRYING},
    PipelineStatus.COMPLETED: set(),
    PipelineStatus.CANCELLED: set(),
}


class PipelineStateError(ValueError):
    pass


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class PipelineEvent:
    stage: PipelineStage
    from_status: PipelineStatus
    to_status: PipelineStatus
    timestamp: str
    message: str = ""
    worker_id: str | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "stage": self.stage.value,
            "from_status": self.from_status.value,
            "to_status": self.to_status.value,
            "timestamp": self.timestamp,
            "message": self.message,
            "worker_id": self.worker_id,
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "PipelineEvent":
        return cls(
            stage=PipelineStage(payload["stage"]),
            from_status=PipelineStatus(payload["from_status"]),
            to_status=PipelineStatus(payload["to_status"]),
            timestamp=str(payload["timestamp"]),
            message=str(payload.get("message", "")),
            worker_id=payload.get("worker_id"),
            error=payload.get("error"),
        )


@dataclass
class PipelineJob:
    job_id: str
    stages: tuple[PipelineStage, ...] = DEFAULT_PIPELINE_STAGES
    status: PipelineStatus = PipelineStatus.QUEUED
    current_stage_index: int = 0
    attempts: int = 0
    max_retries: int = 3
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)
    history: list[PipelineEvent] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.job_id:
            raise PipelineStateError("job_id is required")
        if not self.stages:
            raise PipelineStateError("at least one pipeline stage is required")
        if self.current_stage_index < 0 or self.current_stage_index >= len(self.stages):
            raise PipelineStateError("current_stage_index is outside the pipeline stage range")
        if self.max_retries < 0:
            raise PipelineStateError("max_retries must be non-negative")

    @property
    def current_stage(self) -> PipelineStage:
        return self.stages[self.current_stage_index]

    @property
    def is_terminal(self) -> bool:
        return self.status in {PipelineStatus.COMPLETED, PipelineStatus.CANCELLED}

    @property
    def can_retry(self) -> bool:
        return self.attempts < self.max_retries

    def start(self, worker_id: str | None = None) -> PipelineEvent:
        self.attempts += 1
        return self.transition(PipelineStatus.PROCESSING, message="stage started", worker_id=worker_id)

    def complete_stage(self, message: str = "stage completed") -> PipelineEvent:
        if self.status != PipelineStatus.PROCESSING:
            raise PipelineStateError("only processing stages can be completed")

        event = self.transition(PipelineStatus.COMPLETED, message=message)
        if self.current_stage_index < len(self.stages) - 1:
            self.current_stage_index += 1
            self.status = PipelineStatus.QUEUED
            self.updated_at = event.timestamp
        return event

    def fail(self, error: str, retry: bool = True) -> PipelineEvent:
        if retry and self.can_retry:
            return self.transition(PipelineStatus.RETRYING, error=error, message="stage retry scheduled")
        return self.transition(PipelineStatus.FAILED, error=error, message="stage failed")

    def transition(
        self,
        to_status: PipelineStatus,
        message: str = "",
        worker_id: str | None = None,
        error: str | None = None,
    ) -> PipelineEvent:
        self._ensure_transition_allowed(to_status)
        timestamp = utc_now_iso()
        event = PipelineEvent(
            stage=self.current_stage,
            from_status=self.status,
            to_status=to_status,
            timestamp=timestamp,
            message=message,
            worker_id=worker_id,
            error=error,
        )
        self.status = to_status
        self.updated_at = timestamp
        self.history.append(event)
        return event

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "stages": [stage.value for stage in self.stages],
            "status": self.status.value,
            "current_stage": self.current_stage.value,
            "current_stage_index": self.current_stage_index,
            "attempts": self.attempts,
            "max_retries": self.max_retries,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "history": [event.to_dict() for event in self.history],
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "PipelineJob":
        return cls(
            job_id=str(payload["job_id"]),
            stages=tuple(PipelineStage(stage) for stage in payload.get("stages", DEFAULT_PIPELINE_STAGES)),
            status=PipelineStatus(payload.get("status", PipelineStatus.QUEUED.value)),
            current_stage_index=int(payload.get("current_stage_index", 0)),
            attempts=int(payload.get("attempts", 0)),
            max_retries=int(payload.get("max_retries", 3)),
            metadata=dict(payload.get("metadata", {})),
            created_at=str(payload.get("created_at", utc_now_iso())),
            updated_at=str(payload.get("updated_at", utc_now_iso())),
            history=[
                PipelineEvent.from_dict(event_payload)
                for event_payload in payload.get("history", [])
            ],
        )

    def _ensure_transition_allowed(self, to_status: PipelineStatus) -> None:
        if self.is_terminal:
            raise PipelineStateError(f"terminal job cannot transition from {self.status.value}")

        allowed_statuses = ALLOWED_STATUS_TRANSITIONS[self.status]
        if to_status not in allowed_statuses:
            raise PipelineStateError(
                f"invalid transition from {self.status.value} to {to_status.value}"
            )
