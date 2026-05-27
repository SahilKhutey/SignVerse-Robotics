import asyncio
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class WorkerQueue:
    def __init__(self, num_workers=3):
        self.queue = asyncio.Queue()
        self.num_workers = num_workers
        self.workers = []

    async def start(self):
        for i in range(self.num_workers):
            task = asyncio.create_task(self.worker(f"worker-{i}"))
            self.workers.append(task)
        logger.info(f"Started Task Queue with {self.num_workers} concurrent workers")

    async def worker(self, name: str):
        while True:
            task_node = await self.queue.get()
            logger.info(f"[{name}] Executing task: {task_node.id} - {task_node.type}")
            
            # Simulate physical network dispatch (e.g. gRPC to robotics-service)
            await asyncio.sleep(0.5) 
            
            logger.info(f"[{name}] Completed task: {task_node.id}")
            self.queue.task_done()

    async def dispatch(self, task_node: Dict[str, Any]):
        await self.queue.put(task_node)

    async def wait_completion(self):
        await self.queue.join()

class ExecutionPlanner:
    def __init__(self):
        self.queue = WorkerQueue(num_workers=3)
        self.is_running = False
        
    async def initialize(self):
        if not self.is_running:
            await self.queue.start()
            self.is_running = True

    async def execute_graph(self, task_nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        await self.initialize()
        
        logger.info(f"Dispatching {len(task_nodes)} tasks to distributed worker queue...")
        for node in task_nodes:
            await self.queue.dispatch(node)
            
        # Wait for all parallel tasks to finish
        await self.queue.wait_completion()
        
        logger.info("All workflow tasks completed.")
        return {"status": "workflow_completed", "executed_nodes": len(task_nodes)}
