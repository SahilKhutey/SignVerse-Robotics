# SignVerse Run Configuration

Use this file as the current local runbook until the broader README is cleaned up.

## Environment

Copy `.env.example` to `.env`, or set the variables directly in PowerShell:

```powershell
$env:VITE_API_URL = "http://localhost:8000"
$env:VITE_WS_URL = "ws://localhost:8000"
$env:SIGNVERSE_MODEL_PATH = "models/checkpoints/policy_latest.pth"
$env:SIGNVERSE_SIMULATION_MODE = "true"
$env:SIGNVERSE_SERIAL_PORT = "COM3"
$env:SIGNVERSE_SERIAL_BAUD = "115200"
```

Set `SIGNVERSE_SIMULATION_MODE=false` only when the physical controller is attached and the serial port is correct.

## Backend

Run from `sign-verse-robotics`:

```powershell
uvicorn core.deployment.api_gateway.gateway:app --reload
```

The kernel loads checkpoints in this order:

1. `SIGNVERSE_MODEL_PATH`
2. `models/checkpoints/bc_model.pth`
3. `models/checkpoints/policy_latest.pth`
4. `models/checkpoints/policy_best.pth`
5. `core/learning/models/policy_latest.pth`

## Dashboard

Run from `sign-verse-robotics/apps/dashboard`:

```powershell
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## YouTube Ingestion Workflow

Dashboard path: open the camera/source panel and choose `YouTube Ingestion`.

API path:

```powershell
curl -X POST http://localhost:8000/api/ingest/youtube `
  -H "X-API-Key: signverse_local_dev_key" `
  -H "Content-Type: application/json" `
  -d "{\"url\":\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"}"
```

Runtime flow:

1. Gateway creates a pipeline job with `source_type=youtube`.
2. Redis/RQ runs `services/ingestion-service/worker.py::process_youtube_job`.
3. The worker downloads with `yt-dlp`; if offline and `SIGNVERSE_YOUTUBE_SYNTHETIC_FALLBACK=true`, it generates a synthetic MP4.
4. Frames are extracted into `core/datasets/raw_uploads/frames/<video_id>/`.
5. Frame jobs are queued to the perception queue when Redis is available; if not, frames remain on disk and the worker returns metadata.

Useful ingestion env vars:

```powershell
$env:SIGNVERSE_YOUTUBE_SYNTHETIC_FALLBACK = "true"
$env:SIGNVERSE_INGEST_MAX_FRAMES = "300"
$env:SIGNVERSE_INGEST_FRAME_STRIDE = "1"
```

## Synthetic Simulation Data

Generate a synthetic motion dataset:

```powershell
curl -X POST http://localhost:8000/api/sim/synthetic `
  -H "X-API-Key: signverse_local_dev_key" `
  -H "Content-Type: application/json" `
  -d "{\"pattern\":\"wave\",\"frame_count\":120,\"fps\":30,\"save\":true}"
```

Supported patterns are `wave`, `reach`, and `grasp`. Saved datasets are written to `core/datasets/processed/`.
