import asyncio
import uuid
from typing import Callable, Any

class DistributedTaskRouter:
    """
    Abstration layer for Distributed AI Inference workloads.
    In production, this wraps Celery or Ray. For the initial Cloud OS,
    it implements an async worker pool that decouples heavy AI inference
    from the main websocket thread.
    """
    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers
        self.queue = asyncio.Queue()
        self.workers = []
        self.active_tasks = {}

    async def start_workers(self):
        print(f"[TaskRouter] Starting {self.max_workers} distributed workers...")
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._worker_loop(i))
            self.workers.append(worker)

    async def _worker_loop(self, worker_id: int):
        while True:
            task_id, func, args, kwargs, future = await self.queue.get()
            print(f"[Worker-{worker_id}] Executing Task: {task_id}")
            try:
                # Simulate offloading to a GPU cluster
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    # Run sync functions in a threadpool to prevent blocking
                    result = await asyncio.to_thread(func, *args, **kwargs)
                
                if not future.done():
                    future.set_result(result)
            except Exception as e:
                print(f"[Worker-{worker_id}] Error in Task {task_id}: {e}")
                if not future.done():
                    future.set_exception(e)
            finally:
                self.queue.task_done()
                if task_id in self.active_tasks:
                    del self.active_tasks[task_id]

    async def dispatch(self, func: Callable, *args, **kwargs) -> Any:
        """Dispatch a workload to the distributed queue and await result."""
        task_id = str(uuid.uuid4())
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        
        self.active_tasks[task_id] = "QUEUED"
        await self.queue.put((task_id, func, args, kwargs, future))
        
        return await future

# Global router instance
gpu_cluster = DistributedTaskRouter()
