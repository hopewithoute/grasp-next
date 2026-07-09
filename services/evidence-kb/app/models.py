from enum import StrEnum
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class CurationStatus(StrEnum):
    CANDIDATE = "candidate"
    CERTIFIED = "certified"
    DEPRECATED = "deprecated"
    REJECTED = "rejected"


class IngestionStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Location(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    page: int | None = None
    heading: str | None = None
    start_offset: int | None = None
    end_offset: int | None = None


class SourceRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    tenant_id: str
    project_id: UUID
    external_source_id: UUID
    title: str
    source_type: Literal["text", "markdown", "html", "pdf", "web"]
    metadata: dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    status: CurationStatus = CurationStatus.CANDIDATE
    retrieval_enabled: bool = True
    quality_warnings: list[str] = Field(default_factory=list)


class PassageRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    tenant_id: str
    project_id: UUID
    source_id: UUID
    block_id: str
    text: str
    kind: str
    location: Location
    order: int
    token_count: int
    quality_score: float
    quality_warnings: list[str] = Field(default_factory=list)
    status: CurationStatus = CurationStatus.CANDIDATE
    retrieval_enabled: bool = True


class PaginatedPassagesResponse(BaseModel):
    items: list[PassageRecord]
    total: int


class IngestionRunRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    tenant_id: str
    project_id: UUID
    source_id: UUID
    external_source_id: UUID | None = None
    status: IngestionStatus
    failure_reason: str | None = None
    stats: dict[str, Any] = Field(default_factory=dict)
    started_at: Any | None = None
    completed_at: Any | None = None
    created_at: Any | None = None
    updated_at: Any | None = None


class RetrievedPassage(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    passage_id: UUID
    source_id: UUID
    text: str
    status: str
    quality_score: float
    token_count: int
    retrieval_enabled: bool
    score: float
    bm25_rank: int | None = None
    vector_rank: int | None = None
    rrf_score: float | None = None
    final_rank: int
    location: Location


class RetrievalRunRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    tenant_id: str
    project_id: UUID
    query: str
    mode: str
    filters: dict[str, Any] = Field(default_factory=dict)
    latency_ms: int = 0
    contexts: list[RetrievedPassage] = Field(default_factory=list)


class TopicRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    tenant_id: str
    project_id: UUID
    name: str
    description: str | None = None
    is_user_defined: bool = False


class TopicEdge(BaseModel):
    source: UUID
    target: UUID
    weight: int


class ConceptGraphResponse(BaseModel):
    nodes: list[TopicRecord]
    edges: list[TopicEdge]
