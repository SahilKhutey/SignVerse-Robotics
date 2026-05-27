import asyncio
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
