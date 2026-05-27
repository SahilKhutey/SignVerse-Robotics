from pydantic import BaseModel
from typing import List, Dict

class Permission(BaseModel):
    resource: str
    actions: List[str]

class Role(BaseModel):
    id: str
    permissions: List[Permission]

class RBACEngine:
    def __init__(self):
        # Hardcoded for Sprint 1, would be DB-backed
        self.roles = {
            "robotics-operator": Role(
                id="robotics-operator",
                permissions=[
                    Permission(resource="robotics:movement", actions=["execute", "read"]),
                    Permission(resource="telemetry", actions=["read"])
                ]
            ),
            "observer": Role(
                id="observer",
                permissions=[
                    Permission(resource="telemetry", actions=["read"])
                ]
            )
        }

    def get_role(self, role_id: str) -> Role:
        return self.roles.get(role_id, Role(id="guest", permissions=[]))

    def validate_access(self, role: Role, resource: str, action: str) -> bool:
        for perm in role.permissions:
            if perm.resource == resource and (action in perm.actions or "*" in perm.actions):
                return True
        return False
