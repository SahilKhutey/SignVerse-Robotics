from fastapi import APIRouter, WebSocket

router = APIRouter()

clients = []

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket
):

    await websocket.accept()

    clients.append(websocket)

    try:

        while True:

            data = await websocket.receive_text()

            await websocket.send_text(data)

    except:
        clients.remove(websocket)
