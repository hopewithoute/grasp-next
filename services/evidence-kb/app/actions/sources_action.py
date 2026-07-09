import re
from fastapi import Depends, HTTPException
from app.models import SourceRecord
from app.storage.deps import get_repository
from app.storage.sql_repository import SqlEvidenceRepository
from app.storage.s3_client import s3_client


class SourcesAction:
    def __init__(self, repository: SqlEvidenceRepository = Depends(get_repository)):
        self.repository = repository

    async def find_stale_sources(
        self,
        tenant_id: str,
        project_id: str,
        skip: int,
        limit: int,
    ) -> list[SourceRecord]:
        return await self.repository.find_stale_sources(
            tenant_id=tenant_id,
            project_id=project_id,
            skip=skip,
            limit=limit,
        )

    async def list_sources(
        self,
        tenant_id: str,
        project_id: str,
        skip: int,
        limit: int,
    ) -> list[SourceRecord]:
        return await self.repository.list_project_sources(tenant_id, project_id, skip=skip, limit=limit)

    async def delete_source_with_project(self, tenant_id: str, project_id: str, external_source_id: str) -> dict:
        deleted = await self.repository.delete_source_by_external_id(
            tenant_id=tenant_id, project_id=project_id, external_source_id=external_source_id
        )
        return {"ok": True, "deleted": deleted}

    async def delete_source(self, tenant_id: str, external_source_id: str) -> dict:
        deleted = await self.repository.delete_source_by_external_id(
            tenant_id=tenant_id, external_source_id=external_source_id
        )
        return {"ok": True, "deleted": deleted}

    async def delete_project(self, tenant_id: str, project_id: str) -> dict:
        deleted = await self.repository.delete_project(tenant_id=tenant_id, project_id=project_id)
        return {"ok": True, "deleted": deleted}

    async def get_source_with_project(self, tenant_id: str, project_id: str, external_source_id: str) -> SourceRecord:
        source = await self.repository.get_source_by_external_id(
            tenant_id=tenant_id, project_id=project_id, external_source_id=external_source_id
        )
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        return source

    async def get_source(self, tenant_id: str, external_source_id: str) -> SourceRecord:
        source = await self.repository.get_source_by_external_id(
            tenant_id=tenant_id, external_source_id=external_source_id
        )
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        return source

    async def get_source_download_url(self, tenant_id: str, external_source_id: str) -> dict:
        source = await self.repository.get_source_by_external_id(
            tenant_id=tenant_id, external_source_id=external_source_id
        )
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        s3_key = source.metadata.get("s3_key") if source.metadata else None
        if not s3_key:
            raise HTTPException(status_code=404, detail="Source does not have an associated file")

        url = await s3_client.generate_presigned_url(s3_key)
        if not url:
            raise HTTPException(status_code=500, detail="Failed to generate presigned URL. Is S3 configured?")

        return {"url": url}

    async def get_source_viewer_url(self, tenant_id: str, external_source_id: str) -> dict:
        source = await self.repository.get_source_by_external_id(
            tenant_id=tenant_id, external_source_id=external_source_id
        )
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        source_type = source.source_type

        if source_type == "pdf":
            s3_key = source.metadata.get("s3_key") if source.metadata else None
            if not s3_key:
                raise HTTPException(status_code=404, detail="PDF does not have an associated file in S3")
            url = await s3_client.generate_presigned_url(s3_key)
            if not url:
                raise HTTPException(status_code=500, detail="Failed to generate presigned URL. Is S3 configured?")
            return {"url": url}

        elif source_type == "web":
            url = source.metadata.get("url") if source.metadata else None
            if not url:
                raise HTTPException(status_code=404, detail="Web source does not have a URL")

            # Check if it's YouTube
            yt_match = re.search(
                r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})', str(url)
            )
            if yt_match:
                video_id = yt_match.group(1)
                return {"url": f"https://www.youtube.com/embed/{video_id}"}

            return {"url": str(url)}

        elif source_type in ["text", "markdown", "html"]:
            import markdown

            content = source.metadata.get("content", "") if source.metadata else ""
            html_content = ""
            if source.source_type == "markdown":
                html_content = markdown.markdown(str(content), extensions=["tables", "fenced_code"])
            elif source.source_type == "html":
                html_content = str(content)
            else:
                html_content = (
                    f"<pre style='white-space: pre-wrap; font-family: monospace; font-size: 14px;'>{content}</pre>"
                )

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
