import logging
from typing import List

logger = logging.getLogger(__name__)

# Enterprise Zero-Trust Roles
ROLE_PERMISSIONS = {
    "admin": ["*"],
    "researcher": ["read:telemetry", "execute:inference", "read:datasets"],
    "edge_node": ["write:telemetry", "execute:inference"]
}

class RBACEngine:
    @staticmethod
    def check_permission(user_role: str, required_scope: str) -> bool:
        if user_role not in ROLE_PERMISSIONS:
            logger.warning(f"Access Denied: Unknown role {user_role}")
            return False
            
        allowed_scopes = ROLE_PERMISSIONS[user_role]
        if "*" in allowed_scopes:
            return True
            
        if required_scope in allowed_scopes:
            logger.debug(f"Access Granted: Role {user_role} has scope {required_scope}")
            return True
            
        logger.warning(f"Access Denied: Role {user_role} lacks scope {required_scope}")
        return False
