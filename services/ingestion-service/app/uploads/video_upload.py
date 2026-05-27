from fastapi import APIRouter, UploadFile, File
import shutil
import uuid
import os

router = APIRouter(prefix="/upload")

UPLOAD_DIR = "storage/videos"

os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/video")
async def upload_video(file: UploadFile = File(...)):

    video_id = str(uuid.uuid4())

    file_path = f"{UPLOAD_DIR}/{video_id}_{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "video_id": video_id,
        "path": file_path
    }
