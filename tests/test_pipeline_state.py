import pytest

from core.pipeline import (
    DEFAULT_PIPELINE_STAGES,
    PipelineJob,
    PipelineStage,
    PipelineStateError,
    PipelineStatus,
)


def test_pipeline_job_advances_through_stages():
    job = PipelineJob(job_id="job-001", metadata={"source": "unit-test"})

    assert job.current_stage == PipelineStage.INGESTION
    assert job.status == PipelineStatus.QUEUED

    job.start(worker_id="worker-a")
    first_event = job.complete_stage()

    assert first_event.from_status == PipelineStatus.PROCESSING
    assert first_event.to_status == PipelineStatus.COMPLETED
    assert job.current_stage == PipelineStage.PERCEPTION
    assert job.status == PipelineStatus.QUEUED
    assert job.attempts == 1


def test_pipeline_job_retries_until_limit():
    job = PipelineJob(job_id="job-retry", max_retries=2)

    job.start()
    retry_event = job.fail("redis timeout")

    assert retry_event.to_status == PipelineStatus.RETRYING
    assert job.status == PipelineStatus.RETRYING

    job.start()
    failed_event = job.fail("redis timeout")

    assert failed_event.to_status == PipelineStatus.FAILED
    assert job.status == PipelineStatus.FAILED


def test_pipeline_job_rejects_invalid_transitions():
    job = PipelineJob(job_id="job-invalid")

    with pytest.raises(PipelineStateError, match="invalid transition"):
        job.transition(PipelineStatus.COMPLETED)

    job.start()
    job.complete_stage()

    with pytest.raises(PipelineStateError, match="only processing"):
        job.complete_stage()


def test_pipeline_job_round_trips_to_dict():
    job = PipelineJob(job_id="job-roundtrip", stages=DEFAULT_PIPELINE_STAGES[:2])
    job.start(worker_id="worker-a")
    job.complete_stage("ingestion done")

    restored = PipelineJob.from_dict(job.to_dict())

    assert restored.job_id == job.job_id
    assert restored.stages == job.stages
    assert restored.current_stage == PipelineStage.PERCEPTION
    assert restored.status == PipelineStatus.QUEUED
    assert restored.history[0].worker_id == "worker-a"
