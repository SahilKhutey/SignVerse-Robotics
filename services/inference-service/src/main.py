import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from .gateway.websocket_handler import WebSocketGateway
from .router.model_router import ModelRouter

app = FastAPI(title="SignVerse Inference Gateway")
router = ModelRouter()
ws_gateway = WebSocketGateway(router)

@app.get("/health")
async def health_check():
    return {"status": "online", "service": "inference-service"}

@app.websocket("/ws/infer")
async def websocket_endpoint(websocket: WebSocket):
    await ws_gateway.connect(websocket)
    try:
        while True:
            # Expecting binary frame data or JSON metadata
            data = await websocket.receive_text()
            response = await ws_gateway.process_message(data)
            await websocket.send_json(response)
    except WebSocketDisconnect:
        ws_gateway.disconnect(websocket)
