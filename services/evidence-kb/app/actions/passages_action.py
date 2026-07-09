from typing import Optional
from fastapi import Depends, HTTPException
from app.models import PassageRecord
from app.storage.deps import get_repository
from app.storage.sql_repository import SqlEvidenceRepository


class PassagesAction:
    def __init__(self, repository: SqlEvidenceRepository = Depends(get_repository)):
        self.repository = repository

    async def find_weak_passages(
        self,
        tenant_id: str,
        project_id: str,
        min_quality_score: float,
        skip: int,
        limit: int,
    ) -> list[PassageRecord]:
        return await self.repository.find_weak_passages(
            tenant_id=tenant_id,
            project_id=project_id,
            min_quality_score=min_quality_score,
            skip=skip,
            limit=limit,
        )

    async def list_passages(
        self,
        source_id: str,
        query: Optional[str],
        status: Optional[str],
        retrieval_enabled: Optional[bool],
        sort_field: str,
        sort_direction: str,
        skip: int,
        limit: int,
    ) -> tuple[list[PassageRecord], int]:
        return await self.repository.list_source_passages(
            source_id,
            query=query,
            status=status,
            retrieval_enabled=retrieval_enabled,
            sort_field=sort_field,
            sort_direction=sort_direction,
            skip=skip,
            limit=limit,
        )

    async def inspect_passage(self, passage_id: str) -> PassageRecord:
        passage = await self.repository.get_passage(passage_id)
        if not passage:
            raise HTTPException(status_code=404, detail="Passage not found")
        return passage

    async def get_surrounding_passages(
        self,
        passage_id: str,
        before: int,
        after: int,
    ) -> list[PassageRecord]:
        if before < 0 or after < 0:
            raise HTTPException(status_code=400, detail="before and after must be >= 0")
        if before > 10 or after > 10:
            raise HTTPException(status_code=400, detail="Maximum surrounding window is 10")

        return await self.repository.get_surrounding_passages(passage_id, before=before, after=after)
