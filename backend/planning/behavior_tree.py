from typing import Callable, List, Dict
import asyncio

class BTNode:
    """Base class for Behavior Tree nodes."""
    async def tick(self) -> str:
        # Returns "SUCCESS", "FAILURE", or "RUNNING"
        raise NotImplementedError

class Sequence(BTNode):
    """Executes children in order until one fails."""
    def __init__(self, name: str, children: List[BTNode]):
        self.name = name
        self.children = children
        
    async def tick(self) -> str:
        for child in self.children:
            status = await child.tick()
            if status != "SUCCESS":
                return status
        return "SUCCESS"

class Selector(BTNode):
    """Executes children in order until one succeeds."""
    def __init__(self, name: str, children: List[BTNode]):
        self.name = name
        self.children = children
        
    async def tick(self) -> str:
        for child in self.children:
            status = await child.tick()
            if status == "SUCCESS":
                return "SUCCESS"
            if status == "RUNNING":
                return "RUNNING"
        return "FAILURE"

class Action(BTNode):
    """Leaf node that performs a specific action."""
    def __init__(self, name: str, action_func: Callable):
        self.name = name
        self.action_func = action_func
        
    async def tick(self) -> str:
        try:
            result = await self.action_func()
            return "SUCCESS" if result else "FAILURE"
        except Exception as e:
            print(f"[BT Action {self.name}] Error: {e}")
            return "FAILURE"

class Condition(BTNode):
    """Leaf node that checks a condition."""
    def __init__(self, name: str, check_func: Callable):
        self.name = name
        self.check_func = check_func
        
    async def tick(self) -> str:
        return "SUCCESS" if self.check_func() else "FAILURE"

class BehaviorTreeEngine:
    """Executes a behavior tree recursively."""
    def __init__(self, root: BTNode):
        self.root = root
        
    async def run_cycle(self):
        """Ticks the behavior tree."""
        status = await self.root.tick()
        return status
