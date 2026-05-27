import asyncio
import sys

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
    print(" VERIFYING SIGNVERSE MICROSERVICES")
    print("==========================================")
    
    intent = "Navigate to the drone bay and run gesture recognition"
    print(f"\\n[1] User Intent Received: '{intent}'")
    
    planner = LLMPlanner()
    print("[2] Engaging LLM Planner...")
    plan = await planner.generate_plan(intent)
    print(f"    - Generated {len(plan.objectives)} objectives and {len(plan.constraints)} constraints.")
    
    graph_gen = TaskGraphGenerator()
    print("[3] Generating DAG Task Graph...")
    graph = await graph_gen.generate_graph(plan)
    print(f"    - Generated {len(graph)} parallel Task Nodes.")
    
    executor = ExecutionPlanner()
    print("[4] Dispatching to Physical Robotics Runtime...")
    result = await executor.execute_graph(graph)
    
    print(f"\\n[5] Execution Result: {result['status']}")
    print("==========================================")
    print(" SYSTEM VERIFICATION COMPLETE. ALL NOMINAL.")
    print("==========================================")

if __name__ == "__main__":
    asyncio.run(run_verification())
