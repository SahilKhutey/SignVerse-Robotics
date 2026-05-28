from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Security, HTTPException, status
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app, Counter, Gauge
from pydantic import BaseModel
from typing import Dict, Any
import json
import asyncio
import os

from core.reasoning.llm_agent import CognitiveAgent
from core.os.kernel.signverse_kernel import SignVerseKernel
from core.os.utils.logger import setup_logger
from core.os.utils.config import settings
import threading
import time
from core.deployment.api_gateway.ingestion import router as ingestion_router
from core.deployment.api_gateway.datasets import router as datasets_router
from core.deployment.api_gateway.timeline import router as timeline_router
from core.deployment.api_gateway.retargeting import router as retargeting_router
from core.deployment.api_gateway.training import router as training_router

logger = setup_logger("API_Gateway")

app = FastAPI(title="SignVerse OS Gateway", version="1.0.0")

# Security
API_KEY = settings.os_api_key
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Could not validate credentials"
        )
    return api_key

# Register routers
app.include_router(ingestion_router, dependencies=[Depends(verify_api_key)])
app.include_router(datasets_router, dependencies=[Depends(verify_api_key)])
app.include_router(timeline_router, dependencies=[Depends(verify_api_key)])
app.include_router(retargeting_router, dependencies=[Depends(verify_api_key)])
app.include_router(training_router, dependencies=[Depends(verify_api_key)])

# Observability
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

CMD_COUNTER = Counter("signverse_commands_total", "Total commands processed")
MODE_GAUGE = Gauge("signverse_telemetry_mode", "Current inference mode: 1 for AI, 0 for Math")

# Enable CORS for the React Dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Initialize VLA Cognitive Agent
reasoner = CognitiveAgent()

# 2. Boot the Global OS Kernel
kernel = SignVerseKernel()

# 3. Start OS Tick Loop in background thread
latest_telemetry = {}

def kernel_loop():
    import numpy as np
    global latest_telemetry
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    while True:
        res = kernel.tick(dummy_frame) # Execute 1000Hz OS Tick
        if isinstance(res, dict) and res.get("status") == "CONNECTED":
            latest_telemetry = res
            if res.get("mode") == "ai_inference":
                MODE_GAUGE.set(1)
            else:
                MODE_GAUGE.set(0)
        time.sleep(0.001)

threading.Thread(target=kernel_loop, daemon=True).start()

class CommandRequest(BaseModel):
    command: str

@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {"status": "ok", "service": "SignVerse Gateway"}

from fastapi import Depends

@app.post("/api/command")
async def execute_command(req: CommandRequest, api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    logger.info(f"Received Cognitive Command: {req.command}")
    CMD_COUNTER.inc()
    
    # 1. Parse natural language into robotic JSON
    parsed_command = reasoner.parse_command(req.command)
    
    # 2. Inject override directly into OS Kernel queue
    kernel.inject_command(parsed_command)
    
    logger.info(f"Successfully processed intent: {parsed_command.get('intent')}")
    return {"status": "success", "agent_output": parsed_command}

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Stream the latest robotic state to the React Dashboard at 60 FPS
            if latest_telemetry:
                await websocket.send_json(latest_telemetry)
            
            # Yield GIL to allow REST /api/command to execute in parallel
            await asyncio.sleep(1.0 / 60.0)
    except WebSocketDisconnect:
        pass
