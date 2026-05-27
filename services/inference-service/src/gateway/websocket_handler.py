from fastapi import WebSocket
import json
from ..router.model_router import ModelRouter

class WebSocketGateway:
    def __init__(self, router: ModelRouter):
        self.active_connections: list[WebSocket] = []
        self.router = router

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def process_message(self, message: str) -> dict:
        try:
            payload = json.loads(message)
            # Route to model router
            result = await self.router.route_inference(payload)
            return {"status": "success", "data": result}
        except Exception as e:
            return {"status": "error", "message": str(e)}
