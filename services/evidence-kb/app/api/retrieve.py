from uuid import UUID
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.api.auth import verify_api_key
from app.models import RetrievedPassage
from app.actions.retrieve_action import RetrieveAction
from app.contracts import RetrieveRequest

router = APIRouter(prefix="/v1", tags=["retrieve"])


class RetrieveResponse(BaseModel):
    retrievalRunId: UUID
    query: str
    retrievalMode: str
    contexts: list[RetrievedPassage]
    debug: dict[str, Any]


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(
    request: RetrieveRequest,
    _: None = Depends(verify_api_key),
    action: RetrieveAction = Depends(),
):
    run = await action.retrieve(request)
    return RetrieveResponse(
        retrievalRunId=run.id,
        query=run.query,
        retrievalMode=run.mode,
        contexts=run.contexts,
        debug={"latencyMs": run.latency_ms, "filters": run.filters},
    )
