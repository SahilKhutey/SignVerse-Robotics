from fastapi import APIRouter

router = APIRouter(prefix="/health")

@router.get("/")
async def health_check():
    return {
        "status": "healthy"
    }
