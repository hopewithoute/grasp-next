from fastapi import APIRouter, Depends
from app.api.auth import verify_api_key
from app.models import SourceRecord
from app.actions.sources_action import SourcesAction

router = APIRouter(prefix="/v1/projects", tags=["sources"])
root_router = APIRouter(prefix="/v1/sources", tags=["sources"])


@router.get("/{project_id}/sources/stale", response_model=list[SourceRecord])
async def find_stale_sources(
    project_id: str,
    tenant_id: str = "default",
    skip: int = 0,
    limit: int = 50,
    _: None = Depends(verify_api_key),
    action: SourcesAction = Depends(),
):
    """Return sources that need attention: not certified, disabled retrieval, or have warnings."""
    return await action.find_stale_sources(
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
    action: SourcesAction = Depends(),
):
    return await action.list_sources(tenant_id=tenantId, project_id=project_id, skip=skip, limit=limit)


@router.delete("/{project_id}/sources/{external_source_id}")
async def delete_source_with_project(
    project_id: str,
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    action: SourcesAction = Depends(),
):
    return await action.delete_source_with_project(
        tenant_id=tenantId, project_id=project_id, external_source_id=external_source_id
    )


@root_router.delete("/{external_source_id}")
async def delete_source(
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    action: SourcesAction = Depends(),
):
    return await action.delete_source(tenant_id=tenantId, external_source_id=external_source_id)


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    action: SourcesAction = Depends(),
):
    return await action.delete_project(tenant_id=tenantId, project_id=project_id)


@router.get("/{project_id}/sources/{external_source_id}", response_model=SourceRecord)
async def get_source_with_project(
    project_id: str,
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    action: SourcesAction = Depends(),
):
    return await action.get_source_with_project(
        tenant_id=tenantId, project_id=project_id, external_source_id=external_source_id
    )


@root_router.get("/{external_source_id}", response_model=SourceRecord)
async def get_source(
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    action: SourcesAction = Depends(),
):
    return await action.get_source(tenant_id=tenantId, external_source_id=external_source_id)


@root_router.get("/{external_source_id}/download-url")
async def get_source_download_url(
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    action: SourcesAction = Depends(),
):
    return await action.get_source_download_url(tenant_id=tenantId, external_source_id=external_source_id)


@root_router.get("/{external_source_id}/viewer-url")
async def get_source_viewer_url(
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    action: SourcesAction = Depends(),
):
    return await action.get_source_viewer_url(tenant_id=tenantId, external_source_id=external_source_id)
