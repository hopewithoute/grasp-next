from fastapi import APIRouter, Depends, HTTPException
from app.api.auth import verify_api_key
from app.models import PassageRecord
from app.storage.deps import get_repository
from app.storage.sql_repository import SqlEvidenceRepository

router = APIRouter(prefix="/v1", tags=["passages"])


@router.get("/passages/weak", response_model=list[PassageRecord])
async def find_weak_passages(
    project_id: str,
    tenant_id: str = "default",
    min_quality_score: float = 0.5,
    skip: int = 0,
    limit: int = 50,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    """Return passages that need attention: low quality, warnings, disabled retrieval, or rejected."""
    return await repository.find_weak_passages(
        tenant_id=tenant_id,
        project_id=project_id,
        min_quality_score=min_quality_score,
        skip=skip,
        limit=limit,
    )


@router.get("/sources/{source_id}/passages", response_model=list[PassageRecord])
async def list_passages(
    source_id: str,
    skip: int = 0,
    limit: int = 1000,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    # TODO(Performance): Currently we fetch up to 1000 passages and let the client-side
    # handle search, sorting, filtering, and pagination for a snappy UX.
    # If a single source grows to have massive amounts of passages (>10k), 
    # we should move filtering (status, text search) and sorting logic to the database level here.
    return await repository.list_source_passages(source_id, skip=skip, limit=limit)


@router.get("/passages/{passage_id}", response_model=PassageRecord)
async def inspect_passage(
    passage_id: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    passage = await repository.get_passage(passage_id)
    if not passage:
        raise HTTPException(status_code=404, detail="Passage not found")
    return passage


@router.get("/passages/{passage_id}/surrounding", response_model=list[PassageRecord])
async def get_surrounding_passages(
    passage_id: str,
    before: int = 1,
    after: int = 1,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    """Fetch the surrounding N passages before and after the given passage for expanded context."""
    if before < 0 or after < 0:
        raise HTTPException(status_code=400, detail="before and after must be >= 0")
    if before > 10 or after > 10:
        raise HTTPException(status_code=400, detail="Maximum surrounding window is 10")
        
    return await repository.get_surrounding_passages(passage_id, before=before, after=after)
