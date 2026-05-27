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
    
    for i, frame_path in enumerate(frame_paths):
        q.enqueue('worker.process_frame_job', frame_path, i, len(frame_paths), video_path)

def process_youtube_job(url):
    print(f"Downloading YouTube video: {url}")
    video_path = download_youtube_video(url)
    if video_path:
        process_video_job(video_path)
