from fastapi import APIRouter, Response, Depends
from app.actions.health_action import HealthAction

router = APIRouter()


@router.get("/health")
async def health_check(action: HealthAction = Depends()):
    return await action.check_health()


@router.get("/metadata")
async def metadata(response: Response, action: HealthAction = Depends()):
    response.headers["Cache-Control"] = "public, max-age=300"
    return action.get_metadata()
