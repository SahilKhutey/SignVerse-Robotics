import redis
from rq import Queue
import json
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from smoothing.kalman_filter import JointKalmanFilter

client = AsyncIOMotorClient("mongodb://localhost:27017/")
db = client["signverse"]
collection = db["motions"]

def process_fusion_job_sync(frame_data_json):
    asyncio.run(process_fusion_job_async(frame_data_json))

async def process_fusion_job_async(frame_data_json):
    frame_data = json.loads(frame_data_json)
    
    # In a full implementation, we'd maintain Kalman filters per joint across frames here.
    # For MVP, we pass through the landmarks to storage.
    
    # Upsert the frame into a motion sequence document
    await collection.update_one(
        {"video_id": frame_data["video_id"]},
        {"$push": {"frames": {
            "frame_index": frame_data["frame_index"],
            "landmarks": frame_data["landmarks"]
        }}},
        upsert=True
    )
    print(f"Stored frame {frame_data['frame_index']} for {frame_data['video_id']}")
