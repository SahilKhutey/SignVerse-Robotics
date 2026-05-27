import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. Master Container Orchestration
write_file("docker-compose.yml", """version: '3.8'

services:
  # Infrastructure
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    restart: always

  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: always

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
    restart: always

  # API Gateway
  api-gateway:
    build:
      context: .
      dockerfile: services/base.Dockerfile
    command: uvicorn services.api-gateway.app.main:app --host 0.0.0.0 --port 8000
    ports:
      - "8000:8000"
    volumes:
      - ./services:/app/services
    depends_on:
      - redis
      - mongodb

  # Core Workers (Perception)
  perception-worker:
    build:
      context: .
      dockerfile: services/base.Dockerfile
    command: rq worker perception --url redis://redis:6379
    volumes:
      - ./services:/app/services
      - ./uploads:/app/uploads
    depends_on:
      - redis

volumes:
  mongo_data:
  qdrant_data:
""")

# 2. Microservice Dockerfiles
write_file("services/base.Dockerfile", """FROM python:3.10-slim

# Install system dependencies required for OpenCV, FFMPEG, and headless rendering
RUN apt-get update && apt-get install -y \\
    ffmpeg \\
    libsm6 \\
    libxext6 \\
    libgl1-mesa-glx \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# In a production environment we would copy requirements.txt first
# but for the monorepo MVP we install the core dependencies directly
RUN pip install --no-cache-dir \\
    fastapi uvicorn redis rq pymongo qdrant-client \\
    opencv-python mediapipe yt-dlp h5py \\
    torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Set PYTHONPATH to root so microservices can import from each other
ENV PYTHONPATH=/app
""")

# 3. Frontend Dashboard Shell
write_file("apps/dashboard-web/package.json", """{
  "name": "dashboard-web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@react-three/drei": "^9.105.6",
    "@react-three/fiber": "^8.16.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "three": "^0.164.0",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@types/three": "^0.164.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.2.0"
  }
}
""")

write_file("apps/dashboard-web/vite.config.ts", """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\\/api/, '')
      }
    }
  }
})
""")

# 4. Root CLI / Makefile
write_file("Makefile", """# Sign-Verse Robotics OS Automation

.PHONY: up down logs build front

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

build:
	docker-compose build

front:
	cd apps/dashboard-web && pnpm install && pnpm run dev
""")

print("System Integration Modules implemented.")
