from typing import List
from ..planner.schemas import GoalPlan, TaskNode

class TaskGraphGenerator:
    async def generate_graph(self, plan: GoalPlan) -> List[TaskNode]:
        graph = []
        previous_node_id = None
        
        for obj in plan.objectives:
            node_id = f"task_{obj.id}"
            deps = [previous_node_id] if previous_node_id else []
            
            node = TaskNode(
                id=node_id,
                type=obj.action_type,
                dependencies=deps,
                assignedAgent=f"{obj.action_type}_agent",
                action_payload={"target": obj.target}
            )
            graph.append(node)
            previous_node_id = node_id
            
        return graph
