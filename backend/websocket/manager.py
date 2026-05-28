from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Dictionary mapping topics to lists of WebSockets
        self.active_connections: dict[str, list[WebSocket]] = {
            "telemetry": [],
            "capture": [],
            "pipeline": []
        }

    async def connect(self, websocket: WebSocket, topic: str):
        await websocket.accept()
        if topic not in self.active_connections:
            self.active_connections[topic] = []
        self.active_connections[topic].append(websocket)

    def disconnect(self, websocket: WebSocket, topic: str):
        if topic in self.active_connections and websocket in self.active_connections[topic]:
            self.active_connections[topic].remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str, topic: str):
        if topic in self.active_connections:
            for connection in self.active_connections[topic]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    # Handle dropped connections gracefully
                    pass
