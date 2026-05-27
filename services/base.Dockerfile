FROM python:3.10-slim

# Install system dependencies required for OpenCV, FFMPEG, and headless rendering
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# In a production environment we would copy requirements.txt first
# but for the monorepo MVP we install the core dependencies directly
RUN pip install --no-cache-dir \
    fastapi uvicorn redis rq pymongo qdrant-client \
    opencv-python mediapipe yt-dlp h5py \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Set PYTHONPATH to root so microservices can import from each other
ENV PYTHONPATH=/app
