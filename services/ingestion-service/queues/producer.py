import redis
import json

r = redis.Redis(host='localhost', port=6379, db=0)

def enqueue_video(video_id: str, path: str):

    payload = {
        "video_id": video_id,
        "path": path
    }

    r.lpush("video_ingestion_queue", json.dumps(payload))
