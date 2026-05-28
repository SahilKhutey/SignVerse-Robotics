import asyncio
from backend.runtime.bus import os_bus

class Agent:
    """
    Base class for all cognitive agents in the SignVerse OS.
    Agents communicate exclusively via the os_bus.
    """
    def __init__(self, name: str):
        self.name = name
        self.bus = os_bus
        self.is_running = False

    async def start(self):
        self.is_running = True
        print(f"[Agent:{self.name}] Started.")
        await self.setup()

    async def stop(self):
        self.is_running = False
        print(f"[Agent:{self.name}] Stopped.")

    async def setup(self):
        """Override to subscribe to necessary topics."""
        pass

    async def publish(self, topic: str, payload: any):
        await self.bus.publish(topic, payload)
