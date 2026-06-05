import pytest
import asyncio
import os
from pathlib import Path
from core.replay_buffer import ReplayBuffer

def make_fake_frame(i: int) -> dict:
    return {
        "obs": [float(i)] * 63,
        "jointAngles": [float(i)] * 3,
        "aiPrediction": [0.0] * 3,
        "confidence": 0.95,
        "timestampMs": 1000 + i
    }

def make_fake_entry(label: str, frame_count: int = 10) -> dict:
    return {
        "session_id": f"sess_{label}",
        "label": label,
        "frames": [make_fake_frame(i) for i in range(frame_count)],
        "added_at": 1234567,
        "times_sampled": 0
    }

def test_ring_eviction_at_capacity(tmp_path):
    rb = ReplayBuffer(capacity=500, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()

    async def push_all():
        for i in range(1, 511):
            await rb.push(make_fake_entry(label=f"entry_{i}"))

    asyncio.run(push_all())

    assert len(rb.buffer) == 500
    # Assert entry_1 is gone (oldest is entry_11)
    labels = [entry["label"] for entry in rb.buffer]
    assert "entry_1" not in labels
    assert labels[0] == "entry_11"
    assert labels[-1] == "entry_510"

def test_sample_returns_frames_not_sessions(tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()

    async def run_test():
        # Buffer contains 3 sessions of 50 frames each
        for i in range(3):
            await rb.push(make_fake_entry(label=f"session_{i}", frame_count=50))
        
        # sample(30) returns list of 30 TelemetryFrames/dicts, not ReplayBufferEntries (dicts with frames key)
        sampled = await rb.sample(30)
        assert len(sampled) == 30
        for frame in sampled:
            assert isinstance(frame, dict)
            assert "obs" in frame
            assert "jointAngles" in frame
            assert "frames" not in frame  # Should not be session entry

    asyncio.run(run_test())

def test_sample_on_underfull_buffer(tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()

    async def run_test():
        # Buffer has 10 frames total (1 session of 10 frames)
        await rb.push(make_fake_entry(label="session_0", frame_count=10))
        
        # sample(30) returns all 10 without error. No IndexError, no padding
        sampled = await rb.sample(30)
        assert len(sampled) == 10

    asyncio.run(run_test())

def test_times_sampled_increments(tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()

    async def run_test():
        entry = make_fake_entry(label="session_0", frame_count=10)
        await rb.push(entry)
        
        # Call sample(5) three times
        for _ in range(3):
            await rb.sample(5)
            
        # Assert times_sampled == 3 (since sample selects from buffer and increments times_sampled)
        assert rb.buffer[0]["times_sampled"] == 3

    asyncio.run(run_test())

def test_persist_and_reload(tmp_path):
    persist_file = str(tmp_path / "rb.pkl")
    rb = ReplayBuffer(capacity=50, persist_path=persist_file)
    rb.buffer.clear()

    async def push_all():
        for i in range(20):
            await rb.push(make_fake_entry(label=f"entry_{i}"))

    asyncio.run(push_all())
    rb.save_to_disk()

    # Delete buffer object
    del rb

    # Re-init from same path
    rb2 = ReplayBuffer(capacity=50, persist_path=persist_file)
    assert len(rb2.buffer) == 20
    assert rb2.buffer[0]["label"] == "entry_0"
    assert rb2.buffer[-1]["label"] == "entry_19"

def test_snapshot_excludes_raw_frames(tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()

    async def run_test():
        await rb.push(make_fake_entry(label="session_0", frame_count=5))
        snap = await rb.snapshot()
        assert len(snap) == 1
        assert "frames" not in snap[0]
        assert snap[0]["label"] == "session_0"
        assert snap[0]["frame_count"] == 5

    asyncio.run(run_test())
