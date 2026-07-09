from uuid import UUID
from typing import Any, Literal
from pydantic import BaseModel, Field


class IngestSourceRequest(BaseModel):
    tenantId: str
    projectId: UUID
    externalSourceId: UUID
    title: str
    sourceType: Literal["text", "markdown", "html", "pdf", "web"]
    text: str | None = None
    fileUrl: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestSourceResponse(BaseModel):
    ingestionRunId: UUID
    sourceId: UUID
    status: str
    passageCount: int
    warningCount: int


class RetrieveRequest(BaseModel):
    tenantId: str
    projectId: UUID
    query: str = Field(max_length=2000)
    topK: int = Field(default=12, ge=1, le=100)
    mode: Literal["hybrid", "bm25_only", "vector_only"] = "hybrid"
    filters: dict[str, Any] = Field(default_factory=dict)


class BulkCurationRequest(BaseModel):
    actions: list[dict[str, Any]] = Field(max_length=1000)


class BulkCurationResponse(BaseModel):
    results: list[dict[str, Any]]
    total: int
    succeeded: int
    failed: int


class ExportPassagesRequest(BaseModel):
    source_id: str | None = None
    status: str | None = None
    format: str = "json"
    skip: int = 0
    limit: int = 1000
