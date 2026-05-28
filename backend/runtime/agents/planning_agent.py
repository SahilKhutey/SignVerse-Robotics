from backend.runtime.agents.base import Agent
from backend.planning.behavior_tree import BehaviorTreeEngine, Sequence, Action, Condition
from backend.world_model.scene_graph import human_tracker
from backend.memory.episodic import system_memory
from backend.robotics.manager import robot_bus
import asyncio

class PlanningAgent(Agent):
    """
    Listens for cognitive events and triggers Behavior Trees.
    """
    def __init__(self):
        super().__init__("PlanningAgent")
        self.bt_engine = self._build_default_tree()

    async def setup(self):
        self.bus.subscribe("perception/gesture", self.handle_gesture)

    def _build_default_tree(self):
        # Example: If a human waves, make the robot wave back
        async def action_wave_back():
            print("[PlanningAgent] Executing Action: Waving Back!")
            # Send a fake sequence of joint angles to simulate a wave
            robot_bus.broadcast_pose({"shoulder": 45, "elbow": 45, "base": 0})
            await asyncio.sleep(0.5)
            robot_bus.broadcast_pose({"shoulder": 45, "elbow": -45, "base": 0})
            await asyncio.sleep(0.5)
            robot_bus.broadcast_pose({"shoulder": 0, "elbow": 0, "base": 0})
            return True

        wave_sequence = Sequence("WaveResponse", [
            Condition("CheckRecentWave", lambda: len(system_memory.find_action("wave")) > 0),
            Action("ExecuteWave", action_wave_back)
        ])
        
        return BehaviorTreeEngine(wave_sequence)

    async def handle_gesture(self, event: dict):
        payload = event.get("payload", {})
        gesture = payload.get("gesture")
        human_id = payload.get("human_id", "unknown_human")
        
        if gesture:
            print(f"[PlanningAgent] Detected Intent: {gesture} from {human_id}")
            # 1. Update World Model
            human_tracker.register_gesture(human_id, {"gesture": gesture})
            # 2. Update Episodic Memory
            system_memory.record_episode(
                type="gesture", 
                subject=human_id, 
                action=gesture, 
                context={"confidence": payload.get("confidence", 1.0)}
            )
            # 3. Tick the behavior tree to react
            await self.bt_engine.run_cycle()
