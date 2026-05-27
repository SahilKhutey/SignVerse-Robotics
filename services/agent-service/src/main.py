import asyncio
from fastapi import FastAPI
from pydantic import BaseModel
from .planner.llm_planner import LLMPlanner
from .orchestration.task_graph import TaskGraphGenerator
from .execution.execution_planner import ExecutionPlanner

app = FastAPI(title="SignVerse Agentic Intelligence")
planner = LLMPlanner()
graph_gen = TaskGraphGenerator()
executor = ExecutionPlanner()

class IntentRequest(BaseModel):
    intent: str

@app.get("/health")
async def health_check():
    return {"status": "online", "service": "agent-service"}

@app.post("/agent/intent")
async def process_intent(request: IntentRequest):
    # 1. Plan
    goal_plan = await planner.generate_plan(request.intent)
    
    # 2. Graph
    task_graph = await graph_gen.generate_graph(goal_plan)
    
    # 3. Execute
    execution_result = await executor.execute_graph(task_graph)
    
    return {
        "status": "success",
        "plan": goal_plan.dict(),
        "graph": [node.dict() for node in task_graph],
        "result": execution_result
    }
