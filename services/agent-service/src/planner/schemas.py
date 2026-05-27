from pydantic import BaseModel
from typing import List, Optional

class Constraint(BaseModel):
    type: str
    value: str

class Objective(BaseModel):
    id: str
    description: str
    action_type: str # 'navigate', 'perceive', 'manipulate', 'communicate'
    target: Optional[str] = None

class GoalPlan(BaseModel):
    objectives: List[Objective]
    constraints: List[Constraint]
    requiredTools: List[str]

class TaskNode(BaseModel):
    id: str
    type: str
    dependencies: List[str]
    assignedAgent: Optional[str] = None
    action_payload: dict
