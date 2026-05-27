from fastapi import WebSocket, APIRouter
import asyncio
import json

router = APIRouter()

active_connections = []

@router.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            # We can listen to a Redis PubSub channel here to broadcast new frames
            data = await websocket.receive_text()
            # Echo for testing
            await websocket.send_text(f"Message text was: {data}")
    except Exception as e:
        print(f"WebSocket closed: {e}")
    finally:
        active_connections.remove(websocket)

async def broadcast_frame(frame_data: dict):
    msg = json.dumps(frame_data)
    for conn in active_connections:
        await conn.send_text(msg)
