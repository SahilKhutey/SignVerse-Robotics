import asyncio
import json
import logging
from typing import AsyncGenerator
# from redis.asyncio import Redis # Assume redis is installed

logger = logging.getLogger(__name__)

class RedisTelemetryStream:
    def __init__(self, host='localhost', port=6379, stream_name='telemetry:ros2'):
        self.stream_name = stream_name
        self._connected = False
        # self.redis = Redis(host=host, port=port)

    async def connect(self):
        # await self.redis.ping()
        self._connected = True
        logger.info(f"Connected to Redis stream: {self.stream_name}")

    async def publish_kinematics(self, payload: dict):
        if not self._connected:
            raise ConnectionError("Redis not connected")
        # await self.redis.xadd(self.stream_name, {'payload': json.dumps(payload)})
        logger.debug(f"Published kinematics to {self.stream_name}")

    async def subscribe(self) -> AsyncGenerator[dict, None]:
        # last_id = '$'
        # while True:
        #     messages = await self.redis.xread({self.stream_name: last_id}, count=10, block=100)
        #     for stream, msgs in messages:
        #         for msg_id, msg_data in msgs:
        #             last_id = msg_id
        #             yield json.loads(msg_data[b'payload'].decode('utf-8'))
        
        # Mocking async generator for testing
        while True:
            await asyncio.sleep(0.5)
            yield {"joint_0": 45.0, "joint_1": -10.5, "status": "nominal"}
