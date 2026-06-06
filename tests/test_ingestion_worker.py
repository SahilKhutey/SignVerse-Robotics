import os
import sys
import importlib.util
from pathlib import Path


def test_youtube_worker_synthetic_fallback(monkeypatch, tmp_path):
    service_dir = Path(__file__).resolve().parents[1] / "services" / "ingestion-service"
    sys.path.insert(0, str(service_dir))
    try:
        sys.modules.pop("worker", None)
        spec = importlib.util.spec_from_file_location("worker", service_dir / "worker.py")
        worker = importlib.util.module_from_spec(spec)
        sys.modules["worker"] = worker
        spec.loader.exec_module(worker)
        import youtube_downloader

        monkeypatch.setenv("SIGNVERSE_YOUTUBE_SYNTHETIC_FALLBACK", "1")
        monkeypatch.setenv("SIGNVERSE_INGEST_MAX_FRAMES", "5")
        monkeypatch.setattr(worker.q, "enqueue", lambda *args, **kwargs: None)
        monkeypatch.setattr(
            worker,
            "download_youtube_video",
            lambda url: youtube_downloader.generate_synthetic_youtube_video(output_dir=str(tmp_path / "youtube")),
        )

        result = worker.process_youtube_job("https://www.youtube.com/watch?v=offline-test")

        assert result["status"] == "success"
        assert result["source_type"] == "youtube"
        assert result["frame_count"] == 5
        assert len(result["frames"]) == 5
        assert os.path.exists(result["source_path"])
    finally:
        sys.modules.pop("worker", None)
        sys.modules.pop("youtube_downloader", None)
        sys.modules.pop("video_processor", None)
        if str(service_dir) in sys.path:
            sys.path.remove(str(service_dir))
