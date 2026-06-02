import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.pipeline import PipelineJobStore, PipelineStateError


router = APIRouter(prefix="/api/pipelines", tags=["Pipeline Orchestration"])
pipeline_store = PipelineJobStore(storage_path=os.environ.get("SIGNVERSE_PIPELINE_STORE_PATH"))


class CreatePipelineJobRequest(BaseModel):
    job_id: str | None = None
    stages: list[str] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    max_retries: int = 3


class StartPipelineJobRequest(BaseModel):
    worker_id: str | None = None


class CompletePipelineStageRequest(BaseModel):
    message: str = "stage completed"


class FailPipelineJobRequest(BaseModel):
    error: str
    retry: bool = True


class CancelPipelineJobRequest(BaseModel):
    message: str = "job cancelled"


@router.get("")
async def list_pipeline_jobs() -> dict[str, Any]:
    jobs = [job.to_dict() for job in pipeline_store.list_jobs()]
    return {"status": "success", "jobs": jobs, "total": len(jobs)}


@router.post("")
async def create_pipeline_job(payload: CreatePipelineJobRequest) -> dict[str, Any]:
    try:
        job = pipeline_store.create_job(
            job_id=payload.job_id,
            stages=payload.stages,
            metadata=payload.metadata,
            max_retries=payload.max_retries,
        )
        return {"status": "success", "job": job.to_dict()}
    except (PipelineStateError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{job_id}")
async def get_pipeline_job(job_id: str) -> dict[str, Any]:
    try:
        return {"status": "success", "job": pipeline_store.get_job(job_id).to_dict()}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{job_id}/start")
async def start_pipeline_job(job_id: str, payload: StartPipelineJobRequest) -> dict[str, Any]:
    try:
        job = pipeline_store.start_job(job_id, worker_id=payload.worker_id)
        return {"status": "success", "job": job.to_dict()}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PipelineStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{job_id}/complete")
async def complete_pipeline_stage(job_id: str, payload: CompletePipelineStageRequest) -> dict[str, Any]:
    try:
        job = pipeline_store.complete_stage(job_id, message=payload.message)
        return {"status": "success", "job": job.to_dict()}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PipelineStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{job_id}/fail")
async def fail_pipeline_job(job_id: str, payload: FailPipelineJobRequest) -> dict[str, Any]:
    try:
        job = pipeline_store.fail_job(job_id, error=payload.error, retry=payload.retry)
        return {"status": "success", "job": job.to_dict()}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PipelineStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{job_id}/cancel")
async def cancel_pipeline_job(job_id: str, payload: CancelPipelineJobRequest) -> dict[str, Any]:
    try:
        job = pipeline_store.cancel_job(job_id, message=payload.message)
        return {"status": "success", "job": job.to_dict()}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PipelineStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
