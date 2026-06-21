from uuid import UUID
from typing import Any, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.api.auth import verify_api_key
from app.embedding.client import EmbeddingClient
from app.models import RetrievedPassage
from app.storage.deps import get_repository, get_embedding
from app.storage.sql_repository import SqlEvidenceRepository

router = APIRouter(prefix="/v1", tags=["retrieve"])


class RetrieveRequest(BaseModel):
    tenantId: str
    projectId: UUID
    query: str = Field(max_length=2000)
    topK: int = Field(default=12, ge=1, le=100)
    mode: Literal["hybrid", "bm25_only", "vector_only"] = "hybrid"
    filters: dict[str, Any] = Field(default_factory=dict)


class RetrieveResponse(BaseModel):
    retrievalRunId: UUID
    query: str
    retrievalMode: str
    contexts: list[RetrievedPassage]
    debug: dict[str, Any]


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(
    request: RetrieveRequest,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
    embedding_client: EmbeddingClient | None = Depends(get_embedding),
):
    if not request.query.strip():
        raise HTTPException(status_code=422, detail="query must not be empty")

    query_embedding: list[float] | None = None
    if embedding_client:
        try:
            query_embedding = await embedding_client.embed_query(request.query)
        except Exception:
            pass

    run = await repository.retrieve(
        tenant_id=request.tenantId,
        project_id=request.projectId,
        query=request.query,
        mode=request.mode,
        top_k=request.topK,
        filters=request.filters,
        query_embedding=query_embedding,
    )
    return RetrieveResponse(
        retrievalRunId=run.id,
        query=run.query,
        retrievalMode=run.mode,
        contexts=run.contexts,
        debug={"latencyMs": run.latency_ms, "filters": run.filters},
    )
