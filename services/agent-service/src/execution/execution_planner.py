import asyncio
from typing import List
from ..planner.schemas import TaskNode

class ExecutionPlanner:
    async def execute_graph(self, graph: List[TaskNode]) -> dict:
        results = {}
        for node in graph:
            # In a real DAG, we would execute parallel nodes asynchronously
            print(f"[ExecutionPlanner] Dispatching task {node.id} to {node.assignedAgent}...")
            await asyncio.sleep(0.1) # Simulate network dispatch
            results[node.id] = {"status": "completed"}
            
        return {"status": "workflow_completed", "tasks": results}
