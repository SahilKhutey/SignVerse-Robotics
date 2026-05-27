from abc import ABC, abstractmethod
from typing import Any

class RoboticsDevice(ABC):
    @abstractmethod
    async def connect(self) -> None:
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        pass

    @abstractmethod
    async def send_command(self, command: dict) -> None:
        pass

    @abstractmethod
    async def get_telemetry(self) -> dict:
        pass
