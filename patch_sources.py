from fastapi import HTTPException

@router.get("/{project_id}/sources/{external_source_id}", response_model=SourceRecord)
async def get_source(
    project_id: str,
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    source = await repository.get_source_by_external_id(
        tenant_id=tenantId, project_id=project_id, external_source_id=external_source_id
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source
