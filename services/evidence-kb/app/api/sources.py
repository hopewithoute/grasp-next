from fastapi import APIRouter, Depends
from app.api.auth import verify_api_key
from app.models import SourceRecord
from app.storage.deps import get_repository
from app.storage.sql_repository import SqlEvidenceRepository

router = APIRouter(prefix="/v1/projects", tags=["sources"])
root_router = APIRouter(prefix="/v1/sources", tags=["sources"])

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


@router.delete("/{project_id}/sources/{external_source_id}")
async def delete_source_with_project(
    project_id: str,
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    deleted = await repository.delete_source_by_external_id(
        tenant_id=tenantId, project_id=project_id, external_source_id=external_source_id
    )
    return {"ok": True, "deleted": deleted}

@root_router.delete("/{external_source_id}")
async def delete_source(
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    deleted = await repository.delete_source_by_external_id(
        tenant_id=tenantId, external_source_id=external_source_id
    )
    return {"ok": True, "deleted": deleted}


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    deleted = await repository.delete_project(tenant_id=tenantId, project_id=project_id)
    return {"ok": True, "deleted": deleted}


@router.get("/{project_id}/sources/{external_source_id}", response_model=SourceRecord)
async def get_source_with_project(
    project_id: str,
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    from fastapi import HTTPException
    source = await repository.get_source_by_external_id(
        tenant_id=tenantId, project_id=project_id, external_source_id=external_source_id
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source

@root_router.get("/{external_source_id}", response_model=SourceRecord)
async def get_source(
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    from fastapi import HTTPException
    source = await repository.get_source_by_external_id(
        tenant_id=tenantId, external_source_id=external_source_id
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@root_router.get("/{external_source_id}/download-url")
async def get_source_download_url(
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    from fastapi import HTTPException
    from app.storage.s3_client import s3_client
    
    source = await repository.get_source_by_external_id(
        tenant_id=tenantId, external_source_id=external_source_id
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    s3_key = source.metadata_.get("s3_key") if source.metadata_ else None
    if not s3_key:
        raise HTTPException(status_code=404, detail="Source does not have an associated file")
        
    url = await s3_client.generate_presigned_url(s3_key)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate presigned URL. Is S3 configured?")
        
    return {"url": url}

@root_router.get("/{external_source_id}/viewer-url")
async def get_source_viewer_url(
    external_source_id: str,
    tenantId: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    from fastapi import HTTPException
    from app.storage.s3_client import s3_client
    import re
    from app.settings import get_settings
    
    source = await repository.get_source_by_external_id(
        tenant_id=tenantId, external_source_id=external_source_id
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    source_type = source.source_type
    
    if source_type == "pdf":
        s3_key = source.metadata_.get("s3_key") if source.metadata_ else None
        if not s3_key:
            raise HTTPException(status_code=404, detail="PDF does not have an associated file in S3")
        url = await s3_client.generate_presigned_url(s3_key)
        if not url:
            raise HTTPException(status_code=500, detail="Failed to generate presigned URL. Is S3 configured?")
        return {"url": url}
        
    elif source_type == "web":
        url = source.metadata_.get("url") if source.metadata_ else None
        if not url:
            raise HTTPException(status_code=404, detail="Web source does not have a URL")
        
        # Check if it's YouTube
        yt_match = re.search(r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})', str(url))
        if yt_match:
            video_id = yt_match.group(1)
            return {"url": f"https://www.youtube.com/embed/{video_id}"}
        
        return {"url": str(url)}
        
    elif source_type in ["text", "markdown", "html"]:
        import markdown
        content = source.metadata_.get("content", "") if source.metadata_ else ""
        html_content = ""
        if source.source_type == "markdown":
            html_content = markdown.markdown(str(content), extensions=['tables', 'fenced_code'])
        elif source.source_type == "html":
            html_content = str(content)
        else:
            html_content = f"<pre style='white-space: pre-wrap; font-family: monospace; font-size: 14px;'>{content}</pre>"
            
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>{source.title}</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    line-height: 1.6;
                    padding: 20px;
                    color: #333;
                    background-color: #fff;
                    max-width: 800px;
                    margin: 0 auto;
                }}
                pre, code {{
                    background-color: #f6f8fa;
                    border-radius: 3px;
                }}
                pre {{ padding: 16px; overflow: auto; }}
                table {{ border-collapse: collapse; width: 100%; margin-bottom: 1em; }}
                th, td {{ border: 1px solid #dfe2e5; padding: 6px 13px; }}
                th {{ background-color: #f6f8fa; }}
                blockquote {{
                    border-left: 4px solid #dfe2e5;
                    color: #6a737d;
                    padding-left: 1em;
                    margin-left: 0;
                }}
            </style>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """
        return {"html": html}
        
    raise HTTPException(status_code=400, detail=f"Viewer not supported for source type {source_type}")
