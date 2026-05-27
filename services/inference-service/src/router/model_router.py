import asyncio
from .schemas import InputFrame
from ..gpu.scheduler import GPUScheduler

class ModelRouter:
    def __init__(self):
        self.scheduler = GPUScheduler()

    async def route_inference(self, payload: dict) -> dict:
        frame = InputFrame(**payload)
        
        # Determine execution graph based on requested_models
        models = frame.requested_models or ["pose"]
        
        # Request scheduling
        results = {}
        for model in models:
            # Simulate dispatch to worker
            res = await self.scheduler.schedule_task(model, frame.frame_data)
            results[model] = res
            
        return {
            "frame_id": frame.id,
            "inference": results,
            "latency_ms": 12.4
        }
