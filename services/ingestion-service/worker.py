import redis
from rq import Queue
from video_processor import extract_frames
from youtube_downloader import download_youtube_video

redis_conn = redis.Redis(host='localhost', port=6379)
q = Queue('perception', connection=redis_conn)

def process_video_job(video_path):
    print(f"Extracting frames for {video_path}...")
    frame_paths = extract_frames(video_path)
    print(f"Extracted {len(frame_paths)} frames. Queuing to perception...")

    queued_frames = 0
    
    for i, frame_path in enumerate(frame_paths):
        try:
            q.enqueue('worker.process_frame_job', frame_path, i, len(frame_paths), video_path)
            queued_frames += 1
        except Exception as exc:
            print(f"Perception queue unavailable; frame retained on disk: {frame_path} ({exc})")

    return {
        "status": "success",
        "source_path": video_path,
        "frame_count": len(frame_paths),
        "queued_frames": queued_frames,
        "frame_dir": frame_paths[0].rsplit("\\", 1)[0].rsplit("/", 1)[0] if frame_paths else None,
        "frames": frame_paths,
    }

def process_youtube_job(url):
    print(f"Downloading YouTube video: {url}")
    video_path = download_youtube_video(url)
    if video_path:
        result = process_video_job(video_path)
        result["source_type"] = "youtube"
        result["url"] = url
        return result
    return {"status": "error", "source_type": "youtube", "url": url, "message": "YouTube download failed"}
