from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.api.auth import verify_api_key
from app.storage.deps import get_repository
from app.storage.sql_repository import SqlEvidenceRepository

router = APIRouter(prefix="/v1/curation", tags=["curation"])


class BulkCurationRequest(BaseModel):
    actions: list[dict[str, Any]] = Field(max_length=1000)


class BulkCurationResponse(BaseModel):
    results: list[dict[str, Any]]
    total: int
    succeeded: int
    failed: int


class ExportPassagesRequest(BaseModel):
    source_id: str | None = None
    status: str | None = None
    format: str = "json"
    skip: int = 0
    limit: int = 1000


@router.post("/bulk", response_model=BulkCurationResponse)
async def bulk_curation(
    project_id: str,
    request: BulkCurationRequest,
    tenant_id: str = "default",
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    """Apply multiple curation actions in a single batch with summary."""
    results = await repository.apply_curation_actions(request.actions)
    succeeded = sum(1 for r in results if r.get("ok"))
    return BulkCurationResponse(
        results=results,
        total=len(results),
        succeeded=succeeded,
        failed=len(results) - succeeded,
    )


@router.post("/export")
async def export_passages(
    project_id: str,
    request: ExportPassagesRequest,
    tenant_id: str = "default",
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    """Export passages with optional filtering."""
    filters = {}
    if request.status:
        filters["passageStatus"] = [request.status]

    passages = await repository.export_passages(
        tenant_id, project_id, filters, skip=request.skip, limit=request.limit
    )
    return {"passages": passages, "total": len(passages)}
