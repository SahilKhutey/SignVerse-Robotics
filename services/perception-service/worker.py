import redis
from rq import Queue
from pose.mediapipe_fullbody import extract_fullbody
import json

redis_conn = redis.Redis(host='localhost', port=6379)
q_fusion = Queue('fusion', connection=redis_conn)

def process_frame_job(frame_path, frame_index, total_frames, video_id):
    print(f"Processing frame {frame_index}/{total_frames} for {video_id}...")
    landmarks = extract_fullbody(frame_path)
    
    if landmarks:
        frame_data = {
            "video_id": video_id,
            "frame_index": frame_index,
            "landmarks": landmarks
        }
        # Send to fusion queue for smoothing/storage
        q_fusion.enqueue('worker.process_fusion_job', json.dumps(frame_data))
