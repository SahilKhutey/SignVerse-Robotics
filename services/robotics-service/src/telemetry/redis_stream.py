import json
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

class TelemetryPublisher:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis_client = None
        if REDIS_AVAILABLE:
            self.redis_client = redis.from_url(redis_url)

    async def publish(self, stream_name: str, payload: dict):
        if not REDIS_AVAILABLE or not self.redis_client:
            # print(f"[Telemetry Mock] Publishing to {stream_name}: {payload}")
            return
        
        try:
            # Convert dict to string mapping for Redis XADD
            string_payload = {k: str(v) for k, v in payload.items()}
            await self.redis_client.xadd(stream_name, string_payload)
        except Exception as e:
            print(f"[TelemetryPublisher] Error publishing: {e}")
