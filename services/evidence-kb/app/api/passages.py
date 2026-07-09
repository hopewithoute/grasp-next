from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.api.auth import verify_api_key
from app.models import PassageRecord, PaginatedPassagesResponse
from app.actions.passages_action import PassagesAction

router = APIRouter(prefix="/v1", tags=["passages"])


@router.get("/passages/weak", response_model=list[PassageRecord])
async def find_weak_passages(
    project_id: str,
    tenant_id: str = "default",
    min_quality_score: float = 0.5,
    skip: int = 0,
    limit: int = 50,
    _: None = Depends(verify_api_key),
    action: PassagesAction = Depends(),
):
    """Return passages that need attention: low quality, warnings, disabled retrieval, or rejected."""
    return await action.find_weak_passages(
        tenant_id=tenant_id,
        project_id=project_id,
        min_quality_score=min_quality_score,
        skip=skip,
        limit=limit,
    )


@router.get("/sources/{source_id}/passages", response_model=PaginatedPassagesResponse)
async def list_passages(
    source_id: str,
    query: Optional[str] = None,
    status: Optional[str] = None,
    retrieval_enabled: Optional[bool] = None,
    sort_field: str = Query("order"),
    sort_direction: str = Query("asc"),
    skip: int = 0,
    limit: int = 1000,
    _: None = Depends(verify_api_key),
    action: PassagesAction = Depends(),
):
    items, total = await action.list_passages(
        source_id,
        query=query,
        status=status,
        retrieval_enabled=retrieval_enabled,
        sort_field=sort_field,
        sort_direction=sort_direction,
        skip=skip,
        limit=limit,
    )
    return PaginatedPassagesResponse(items=items, total=total)


@router.get("/passages/{passage_id}", response_model=PassageRecord)
async def inspect_passage(
    passage_id: str,
    _: None = Depends(verify_api_key),
    action: PassagesAction = Depends(),
):
    return await action.inspect_passage(passage_id)


@router.get("/passages/{passage_id}/surrounding", response_model=list[PassageRecord])
async def get_surrounding_passages(
    passage_id: str,
    before: int = 1,
    after: int = 1,
    _: None = Depends(verify_api_key),
    action: PassagesAction = Depends(),
):
    """Fetch the surrounding N passages before and after the given passage for expanded context."""
    return await action.get_surrounding_passages(passage_id, before=before, after=after)
