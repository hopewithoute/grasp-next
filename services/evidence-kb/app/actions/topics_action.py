from fastapi import Depends
from app.models import ConceptGraphResponse, TopicRecord
from app.storage.deps import get_repository
from app.storage.sql_repository import SqlEvidenceRepository


class TopicsAction:
    def __init__(self, repository: SqlEvidenceRepository = Depends(get_repository)):
        self.repository = repository

    async def list_topics(self, tenant_id: str, project_id: str) -> list[TopicRecord]:
        return await self.repository.list_topics(tenant_id=tenant_id, project_id=project_id)

    async def get_concept_graph(self, tenant_id: str, project_id: str, min_weight: int) -> ConceptGraphResponse:
        return await self.repository.get_concept_graph(
            tenant_id=tenant_id, project_id=project_id, min_weight=min_weight
        )
