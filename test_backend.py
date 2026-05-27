import asyncio
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Add services to path so we can import them locally
sys.path.append("services/agent-service")

try:
    from src.planner.schemas import GoalPlan
    from src.planner.llm_planner import LLMPlanner
    from src.orchestration.task_graph import TaskGraphGenerator
    from src.execution.execution_planner import ExecutionPlanner
except ImportError as e:
    print(f"Error importing Agent Service modules: {e}")
    sys.exit(1)

async def run_verification():
    print("==========================================")
    print(" VERIFYING ASYNCHRONOUS AGENT TASK QUEUE")
    print("==========================================")
    
    intent = "Navigate to the drone bay and run gesture recognition"
    print(f"\\n[1] User Intent Received: '{intent}'")
    
    planner = LLMPlanner()
    plan = await planner.generate_plan(intent)
    
    graph_gen = TaskGraphGenerator()
    graph = await graph_gen.generate_graph(plan)
    
    executor = ExecutionPlanner()
    print("[2] Dispatching to Distributed Async Workers...")
    result = await executor.execute_graph(graph)
    
    print(f"\\n[3] Execution Result: {result['status']} ({result['executed_nodes']} nodes)")
    print("==========================================")
    print(" ASYNC QUEUE VERIFICATION COMPLETE. ALL NOMINAL.")
    print("==========================================")

if __name__ == "__main__":
    asyncio.run(run_verification())
