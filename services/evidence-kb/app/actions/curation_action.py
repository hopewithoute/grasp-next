from typing import Any, TYPE_CHECKING
from fastapi import Depends
from app.storage.deps import get_repository
from app.storage.sql_repository import SqlEvidenceRepository

if TYPE_CHECKING:
    from app.contracts import BulkCurationRequest, ExportPassagesRequest


class CurationAction:
    def __init__(self, repository: SqlEvidenceRepository = Depends(get_repository)):
        self.repository = repository

    async def bulk_curation(self, request: "BulkCurationRequest") -> list[dict[str, Any]]:
        return await self.repository.apply_curation_actions(request.actions)

    async def export_passages(
        self,
        tenant_id: str,
        project_id: str,
        request: "ExportPassagesRequest",
    ) -> tuple[list[Any], int]:
        filters = {}
        if request.status:
            filters["passageStatus"] = request.status if isinstance(request.status, list) else [request.status]
        if request.source_id:
            filters["sourceId"] = request.source_id

        # Currently we only export via retrieval interface. A dedicated export might be needed for large volumes
        # This calls a generic retrieve for now
        run = await self.repository.retrieve(
            tenant_id=tenant_id,
            project_id=project_id,
            query="",
            mode="bm25_only",
            top_k=request.limit,
            filters=filters,
        )

        return run.contexts, len(run.contexts)
