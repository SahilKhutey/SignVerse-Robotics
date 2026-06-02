from __future__ import annotations

import json
from pathlib import Path
from threading import RLock
from typing import Any
from uuid import uuid4

from core.pipeline.state import (
    DEFAULT_PIPELINE_STAGES,
    PipelineJob,
    PipelineStage,
    PipelineStateError,
    PipelineStatus,
)


PIPELINE_STORE_VERSION = "pipeline.job_store.v1"


class PipelineJobStore:
    def __init__(self, storage_path: str | Path | None = None) -> None:
        self._storage_path = Path(storage_path) if storage_path else None
        self._jobs: dict[str, PipelineJob] = {}
        self._lock = RLock()
        self._load()

    def create_job(
        self,
        job_id: str | None = None,
        stages: list[str] | tuple[str, ...] | None = None,
        metadata: dict[str, Any] | None = None,
        max_retries: int = 3,
    ) -> PipelineJob:
        resolved_job_id = job_id or f"job-{uuid4().hex}"
        resolved_stages = self._parse_stages(stages)

        with self._lock:
            if resolved_job_id in self._jobs:
                raise PipelineStateError(f"pipeline job already exists: {resolved_job_id}")
            job = PipelineJob(
                job_id=resolved_job_id,
                stages=resolved_stages,
                metadata=metadata or {},
                max_retries=max_retries,
            )
            self._jobs[resolved_job_id] = job
            self._persist()
            return job

    def list_jobs(self) -> list[PipelineJob]:
        with self._lock:
            return list(self._jobs.values())

    def get_job(self, job_id: str) -> PipelineJob:
        with self._lock:
            try:
                return self._jobs[job_id]
            except KeyError as exc:
                raise KeyError(f"pipeline job not found: {job_id}") from exc

    def start_job(self, job_id: str, worker_id: str | None = None) -> PipelineJob:
        with self._lock:
            job = self.get_job(job_id)
            job.start(worker_id=worker_id)
            self._persist()
            return job

    def complete_stage(self, job_id: str, message: str = "stage completed") -> PipelineJob:
        with self._lock:
            job = self.get_job(job_id)
            job.complete_stage(message=message)
            self._persist()
            return job

    def fail_job(self, job_id: str, error: str, retry: bool = True) -> PipelineJob:
        with self._lock:
            job = self.get_job(job_id)
            job.fail(error=error, retry=retry)
            self._persist()
            return job

    def cancel_job(self, job_id: str, message: str = "job cancelled") -> PipelineJob:
        with self._lock:
            job = self.get_job(job_id)
            job.transition(PipelineStatus.CANCELLED, message=message)
            self._persist()
            return job

    def clear(self) -> None:
        with self._lock:
            self._jobs.clear()
            self._persist()

    def to_dict(self) -> dict[str, Any]:
        with self._lock:
            return {
                "store_version": PIPELINE_STORE_VERSION,
                "jobs": [job.to_dict() for job in self.list_jobs()],
            }

    def flush(self) -> None:
        with self._lock:
            self._persist()

    @staticmethod
    def _parse_stages(stages: list[str] | tuple[str, ...] | None) -> tuple[PipelineStage, ...]:
        if stages is None:
            return DEFAULT_PIPELINE_STAGES
        parsed = tuple(PipelineStage(stage) for stage in stages)
        if not parsed:
            raise PipelineStateError("at least one pipeline stage is required")
        return parsed

    def _load(self) -> None:
        if self._storage_path is None or not self._storage_path.exists():
            return

        try:
            payload = json.loads(self._storage_path.read_text(encoding="utf-8"))
            if payload.get("store_version") != PIPELINE_STORE_VERSION:
                raise PipelineStateError(
                    f"unsupported pipeline store version: {payload.get('store_version')}"
                )
            jobs = {}
            for job_payload in payload.get("jobs", []):
                job = PipelineJob.from_dict(job_payload)
                jobs[job.job_id] = job
            self._jobs = jobs
        except json.JSONDecodeError as exc:
            raise PipelineStateError(f"invalid pipeline store JSON: {exc}") from exc

    def _persist(self) -> None:
        if self._storage_path is None:
            return

        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._storage_path.with_name(f"{self._storage_path.name}.tmp")
        temp_path.write_text(
            json.dumps(
                {
                    "store_version": PIPELINE_STORE_VERSION,
                    "jobs": [job.to_dict() for job in self._jobs.values()],
                },
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
        temp_path.replace(self._storage_path)
