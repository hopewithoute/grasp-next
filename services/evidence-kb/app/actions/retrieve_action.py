from fastapi import Depends, HTTPException
from app.embedding.client import EmbeddingClient
from app.storage.deps import get_repository, get_embedding
from app.storage.sql_repository import SqlEvidenceRepository
from app.models import RetrievalRunRecord
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.contracts import RetrieveRequest


class RetrieveAction:
    def __init__(
        self,
        repository: SqlEvidenceRepository = Depends(get_repository),
        embedding_client: EmbeddingClient | None = Depends(get_embedding),
    ):
        self.repository = repository
        self.embedding_client = embedding_client

    async def retrieve(
        self,
        request: "RetrieveRequest",
    ) -> RetrievalRunRecord:

        if not request.query.strip():
            raise HTTPException(status_code=422, detail="query must not be empty")

        query_embedding: list[float] | None = None
        if self.embedding_client:
            try:
                query_embedding = await self.embedding_client.embed_query(request.query)
            except Exception:
                pass

        return await self.repository.retrieve(
            tenant_id=request.tenantId,
            project_id=str(request.projectId),
            query=request.query,
            mode=request.mode,
            top_k=request.topK,
            filters=request.filters,
            query_embedding=query_embedding,
        )
