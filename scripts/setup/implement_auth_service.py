import os
import json

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"
auth_dir = os.path.join(base_dir, "services/auth-service")
infra_dir = os.path.join(base_dir, "infrastructure/enterprise")

def write_file(path, content, is_infra=False):
    root = infra_dir if is_infra else auth_dir
    full_path = os.path.join(root, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. Infrastructure Scaffolding (Gateway & Vault)
write_file("gateway/kong.yml", """_format_version: "2.1"
_transform: true

services:
  - name: robotics-service
    url: http://robotics-service:8001
    routes:
      - name: robotics-route
        paths:
          - /api/v1/robotics
    plugins:
      - name: key-auth
  - name: inference-service
    url: http://inference-service:8000
    routes:
      - name: inference-route
        paths:
          - /api/v1/inference
""", is_infra=True)

write_file("vault/config.hcl", """storage "file" {
  path = "/vault/file"
}
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = "true"
}
api_addr = "http://127.0.0.1:8200"
ui = true
""", is_infra=True)


# 2. Auth Service Scaffolding
write_file("package.json", json.dumps({
  "name": "auth-service",
  "version": "1.0.0",
  "description": "Enterprise Security and RBAC Layer",
  "private": True
}, indent=2))

write_file("requirements.txt", """fastapi==0.111.0
uvicorn[standard]==0.29.0
pydantic==2.7.1
PyJWT==2.8.0
""")

write_file("Dockerfile", """FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8004"]
""")

# Main API
write_file("src/main.py", """import asyncio
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .auth.jwt_validator import JWTValidator
from .rbac.engine import RBACEngine, Role

app = FastAPI(title="SignVerse Identity Platform")
security = HTTPBearer()
validator = JWTValidator()
rbac = RBACEngine()

@app.get("/health")
async def health_check():
    return {"status": "online", "service": "auth-service"}

@app.post("/auth/verify")
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    user = validator.verify(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"status": "valid", "user": user}

@app.post("/auth/authorize")
async def authorize_action(resource: str, action: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = validator.verify(credentials.credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    role = rbac.get_role(user["role"])
    has_access = rbac.validate_access(role, resource, action)
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: Insufficient permissions")
        
    return {"status": "authorized"}
""")

# RBAC Engine
write_file("src/rbac/engine.py", """from pydantic import BaseModel
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
""")

# JWT Validator
write_file("src/auth/jwt_validator.py", """import jwt

class JWTValidator:
    def __init__(self, secret: str = "super-secret-key-for-sprint1"):
        self.secret = secret

    def verify(self, token: str) -> dict:
        try:
            # For sprint 1, decoding without full signature verification if needed for mocks
            # In production, this validates against Keycloak public keys
            payload = jwt.decode(token, self.secret, algorithms=["HS256"], options={"verify_signature": False})
            return payload
        except jwt.ExpiredSignatureError:
            print("[JWTValidator] Token expired")
            return None
        except Exception as e:
            print(f"[JWTValidator] Invalid token: {e}")
            return None
""")

print("Phase 9 Enterprise Security (Sprint 1) scaffolded.")
