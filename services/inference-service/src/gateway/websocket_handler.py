from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import json
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("New Edge Device connected to Inference Gateway")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

manager = ConnectionManager()

@router.websocket("/ws/stream")
async def inference_stream(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive raw bytes (e.g. h264 chunks or jpeg frames)
            data = await websocket.receive_bytes()
            # Decode/Route to PyTorch model (mocked here for latency testing)
            await asyncio.sleep(0.01) # 10ms inference time mock
            
            # Send detection response back
            response = {"bounding_boxes": [[10, 10, 50, 50]], "class": "hand_gesture", "confidence": 0.95}
            await websocket.send_text(json.dumps(response))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Edge Device disconnected")
