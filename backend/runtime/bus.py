import asyncio
from typing import Callable, Dict, List, Any
import time

class EventBus:
    """
    Central Nervous System for the Embodied AI Runtime.
    Asynchronous Pub/Sub broker for multi-agent communication.
    """
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        self._event_history: List[Dict[str, Any]] = []

    def subscribe(self, topic: str, callback: Callable):
        if topic not in self._subscribers:
            self._subscribers[topic] = []
        self._subscribers[topic].append(callback)
        print(f"[EventBus] Subscribed to {topic}")

    async def publish(self, topic: str, payload: Any):
        """Publish an event to all subscribers of a topic."""
        event = {
            "topic": topic,
            "timestamp": time.time(),
            "payload": payload
        }
        self._event_history.append(event)
        
        # Keep history bounded
        if len(self._event_history) > 1000:
            self._event_history.pop(0)

        if topic in self._subscribers:
            for callback in self._subscribers[topic]:
                # Callbacks should be async
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(event))
                else:
                    callback(event)

# Global Singleton Event Bus
os_bus = EventBus()
