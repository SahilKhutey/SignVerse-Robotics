import json
import uuid
from pathlib import Path

import pytest

from core.pipeline import (
    PIPELINE_STORE_VERSION,
    PipelineJobStore,
    PipelineStage,
    PipelineStateError,
    PipelineStatus,
)


def test_pipeline_store_creates_and_lists_jobs():
    store = PipelineJobStore()

    job = store.create_job(
        job_id="store-job-001",
        stages=["ingestion", "perception"],
        metadata={"source": "unit-test"},
    )

    assert job.job_id == "store-job-001"
    assert job.current_stage == PipelineStage.INGESTION
    assert store.list_jobs() == [job]


def test_pipeline_store_advances_job_lifecycle():
    store = PipelineJobStore()
    store.create_job(job_id="store-job-002", stages=["ingestion", "export"])

    started = store.start_job("store-job-002", worker_id="worker-1")
    assert started.status == PipelineStatus.PROCESSING

    advanced = store.complete_stage("store-job-002")
    assert advanced.status == PipelineStatus.QUEUED
    assert advanced.current_stage == PipelineStage.EXPORT

    store.start_job("store-job-002", worker_id="worker-2")
    completed = store.complete_stage("store-job-002")
    assert completed.status == PipelineStatus.COMPLETED


def test_pipeline_store_handles_failures_and_missing_jobs():
    store = PipelineJobStore()
    store.create_job(job_id="store-job-003", max_retries=1)

    store.start_job("store-job-003")
    failed = store.fail_job("store-job-003", error="decode failed")
    assert failed.status == PipelineStatus.FAILED

    with pytest.raises(KeyError, match="not found"):
        store.get_job("missing")

    with pytest.raises(PipelineStateError, match="already exists"):
        store.create_job(job_id="store-job-003")


def test_pipeline_store_persists_and_restores_jobs():
    storage_path = Path(".tmp_test_artifacts") / f"pipeline_store_{uuid.uuid4().hex}.json"
    store = PipelineJobStore(storage_path=storage_path)

    store.create_job(job_id="persistent-job", stages=["ingestion", "export"])
    store.start_job("persistent-job", worker_id="worker-a")
    store.complete_stage("persistent-job", message="ingestion complete")

    assert storage_path.exists()
    stored_payload = json.loads(storage_path.read_text(encoding="utf-8"))
    assert stored_payload["store_version"] == PIPELINE_STORE_VERSION

    restored_store = PipelineJobStore(storage_path=storage_path)
    restored_job = restored_store.get_job("persistent-job")

    assert restored_job.current_stage == PipelineStage.EXPORT
    assert restored_job.status == PipelineStatus.QUEUED
    assert restored_job.history[0].worker_id == "worker-a"

    restored_store.clear()
    assert json.loads(storage_path.read_text(encoding="utf-8"))["jobs"] == []
