from fastapi import APIRouter, UploadFile, File
import uuid
import shutil
import os

router = APIRouter()

UPLOAD_DIR = "storage/videos"

os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload/video")
async def upload_video(
    file: UploadFile = File(...)
):

    video_id = str(uuid.uuid4())

    path = f"{UPLOAD_DIR}/{video_id}.mp4"

    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "video_id": video_id,
        "path": path
    }
