from fastapi import APIRouter, Depends
from app.api.auth import verify_api_key
from app.actions.curation_action import CurationAction
from app.contracts import BulkCurationRequest, BulkCurationResponse, ExportPassagesRequest

router = APIRouter(prefix="/v1/curation", tags=["curation"])


@router.post("/bulk", response_model=BulkCurationResponse)
async def bulk_curation(
    project_id: str,
    request: BulkCurationRequest,
    tenant_id: str = "default",
    _: None = Depends(verify_api_key),
    action: CurationAction = Depends(),
):
    """Apply multiple curation actions in a single batch with summary."""
    results = await action.bulk_curation(request)
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
    action: CurationAction = Depends(),
):
    """Export passages with optional filtering."""
    contexts, total = await action.export_passages(
        tenant_id=tenant_id,
        project_id=project_id,
        request=request,
    )

    return {
        "format": request.format,
        "total": total,
        "passages": contexts,
    }
