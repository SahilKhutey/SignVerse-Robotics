import asyncio
from fastapi import FastAPI, UploadFile, File, Form
from .storage.s3_provider import S3StorageProvider
from .indexing.qdrant_search import VectorSearchEngine

app = FastAPI(title="SignVerse Dataset Platform")
storage = S3StorageProvider()
search_engine = VectorSearchEngine()

@app.get("/health")
async def health_check():
    return {"status": "online", "service": "dataset-service"}

@app.post("/dataset/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    metadata_json: str = Form(...)
):
    # Simulated streaming upload to MinIO/S3
    content = await file.read()
    file_uri = await storage.upload_file(file.filename, content)
    
    # Trigger metadata indexing (mock)
    await search_engine.index_dataset(file.filename, metadata_json)
    
    return {"status": "success", "uri": file_uri, "indexed": True}
