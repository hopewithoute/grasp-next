from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import declarative_base, deferred
from sqlalchemy.schema import Computed
from pgvector.sqlalchemy import Vector
from app.settings import get_settings

settings = get_settings()
Base = declarative_base()

CURATION_STATUS_CHECK = "status IN ('candidate', 'certified', 'deprecated', 'rejected')"
INGESTION_STATUS_CHECK = "status IN ('queued', 'processing', 'completed', 'failed')"
SOURCE_TYPE_CHECK = "source_type IN ('text', 'markdown', 'html', 'pdf', 'web')"


class EvidenceKbBase(Base):
    __abstract__ = True
    __table_args__ = {"schema": settings.DB_SCHEMA}


class KbSource(EvidenceKbBase):
    __tablename__ = "kb_sources"

    id = Column(UUID(as_uuid=True), primary_key=True)
    tenant_id = Column(Text, nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    external_source_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(Text, nullable=False)
    source_type = Column(Text, nullable=False)
    source_uri = Column(Text, nullable=True)
    file_ref = Column(Text, nullable=True)
    checksum = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=False, server_default="{}")
    status = Column(Text, nullable=False, server_default="candidate")
    retrieval_enabled = Column(Boolean, nullable=False, server_default="true")
    quality_warnings = Column(JSONB, nullable=False, server_default="[]")
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    next_review_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(SOURCE_TYPE_CHECK, name="kb_sources_source_type_check"),
        CheckConstraint(CURATION_STATUS_CHECK, name="kb_sources_status_check"),
        UniqueConstraint("tenant_id", "project_id", "external_source_id", name="kb_sources_external_unique"),
        Index("kb_sources_project_idx", "tenant_id", "project_id", "created_at"),
        Index("kb_sources_status_idx", "status", "retrieval_enabled"),
        {"schema": settings.DB_SCHEMA},
    )


class KbIngestionRun(EvidenceKbBase):
    __tablename__ = "kb_ingestion_runs"

    id = Column(UUID(as_uuid=True), primary_key=True)
    tenant_id = Column(Text, nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    source_id = Column(
        UUID(as_uuid=True), ForeignKey(f"{settings.DB_SCHEMA}.kb_sources.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(Text, nullable=False, server_default="processing")
    failure_reason = Column(Text, nullable=True)
    stats = Column(JSONB, nullable=False, server_default="{}")
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(INGESTION_STATUS_CHECK, name="kb_ingestion_runs_status_check"),
        Index("kb_ingestion_runs_source_idx", "source_id", "created_at"),
        {"schema": settings.DB_SCHEMA},
    )


class KbPassage(EvidenceKbBase):
    __tablename__ = "kb_passages"

    id = Column(UUID(as_uuid=True), primary_key=True)
    tenant_id = Column(Text, nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    source_id = Column(
        UUID(as_uuid=True), ForeignKey(f"{settings.DB_SCHEMA}.kb_sources.id", ondelete="CASCADE"), nullable=False
    )
    block_id = Column(Text, nullable=False)
    text = Column(Text, nullable=False)
    kind = Column(Text, nullable=False, server_default="text")
    location = Column(JSONB, nullable=False, server_default="{}")
    order = Column("order", Integer, nullable=False)
    token_count = Column(Integer, nullable=False)
    quality_score = Column(Float, nullable=False, server_default="1")
    quality_warnings = Column(JSONB, nullable=False, server_default="[]")
    status = Column(Text, nullable=False, server_default="candidate")
    retrieval_enabled = Column(Boolean, nullable=False, server_default="true")
    embedding = deferred(Column(Vector(settings.EMBEDDING_DIMENSIONS), nullable=True))
    search_vector = deferred(Column(TSVECTOR, Computed("to_tsvector('simple', text)", persisted=True), nullable=False))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(CURATION_STATUS_CHECK, name="kb_passages_status_check"),
        UniqueConstraint("source_id", "block_id", name="kb_passages_source_block_unique"),
        Index("kb_passages_source_idx", "source_id", "order"),
        Index("kb_passages_project_export_idx", "tenant_id", "project_id", "source_id", "order"),
        Index("kb_passages_project_quality_idx", "tenant_id", "project_id", "quality_score"),
        Index("kb_passages_project_filter_idx", "tenant_id", "project_id", "status", "retrieval_enabled"),
        Index("kb_passages_search_idx", "search_vector", postgresql_using="gin"),
        Index(
            "kb_passages_embedding_idx",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        {"schema": settings.DB_SCHEMA},
    )


class KbRetrievalRun(EvidenceKbBase):
    __tablename__ = "kb_retrieval_runs"

    id = Column(UUID(as_uuid=True), primary_key=True)
    tenant_id = Column(Text, nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    query = Column(Text, nullable=False)
    mode = Column(Text, nullable=False, server_default="hybrid")
    filters = Column(JSONB, nullable=False, server_default="{}")
    latency_ms = Column(Integer, nullable=False, server_default="0")
    debug = Column(JSONB, nullable=False, server_default="{}")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("kb_retrieval_runs_project_idx", "tenant_id", "project_id", "created_at"),
        {"schema": settings.DB_SCHEMA},
    )


class KbRetrievedPassage(EvidenceKbBase):
    __tablename__ = "kb_retrieved_passages"

    retrieval_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey(f"{settings.DB_SCHEMA}.kb_retrieval_runs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    passage_id = Column(
        UUID(as_uuid=True),
        ForeignKey(f"{settings.DB_SCHEMA}.kb_passages.id", ondelete="CASCADE"),
        primary_key=True,
    )
    bm25_rank = Column(Integer, nullable=True)
    vector_rank = Column(Integer, nullable=True)
    rrf_score = Column(Float, nullable=True)
    final_rank = Column(Integer, nullable=False)
    score = Column(Float, nullable=False)
    used_in_answer = Column(Boolean, nullable=True)
