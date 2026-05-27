from abc import ABC, abstractmethod
from typing import Any

class InferenceWorker(ABC):
    @abstractmethod
    async def load_model(self) -> None:
        pass

    @abstractmethod
    async def infer(self, input_tensor: Any) -> dict:
        pass

    @abstractmethod
    async def dispose(self) -> None:
        pass
