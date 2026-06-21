from fastapi import APIRouter, Depends
from app.api.auth import verify_api_key
from app.models import SourceRecord
from app.storage.deps import get_repository
from app.storage.sql_repository import SqlEvidenceRepository

router = APIRouter(prefix="/v1/projects", tags=["sources"])


@router.get("/{project_id}/sources/stale", response_model=list[SourceRecord])
async def find_stale_sources(
    project_id: str,
    tenant_id: str = "default",
    skip: int = 0,
    limit: int = 50,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    """Return sources that need attention: not certified, disabled retrieval, or have warnings."""
    return await repository.find_stale_sources(
        tenant_id=tenant_id,
        project_id=project_id,
        skip=skip,
        limit=limit,
    )


@router.get("/{project_id}/sources", response_model=list[SourceRecord])
async def list_sources(
    project_id: str,
    tenantId: str,
    skip: int = 0,
    limit: int = 1000,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    return await repository.list_project_sources(tenantId, project_id, skip=skip, limit=limit)
