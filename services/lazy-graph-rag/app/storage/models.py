import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, ForeignKey,
    UniqueConstraint, Index, func, Computed
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR, ENUM
from sqlalchemy.orm import declarative_base, relationship
from pgvector.sqlalchemy import HALFVEC

Base = declarative_base()

class LGSBase(Base):
    __abstract__ = True
    __table_args__ = {"schema": "lgs"}

term_status_enum = ENUM('raw', 'verified', 'merged', 'flagged', name='term_status', schema='lgs')

class Document(LGSBase):
    __tablename__ = 'documents'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False, server_default='')
    collection_id = Column(String, nullable=False) # projectId equivalent
    source_id = Column(String, nullable=False) # projectSourceId equivalent
    document_name = Column(Text, nullable=False)
    source_type = Column(Text, nullable=False)
    source_uri = Column(Text, nullable=True)
    content_hash = Column(Text, nullable=False)
    normalized_content = Column(Text, nullable=False)
    content_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index('documents_collection_idx', 'collection_id'),
        Index('documents_source_idx', 'source_id'),
        {"schema": "lgs"}
    )

class Chunk(LGSBase):
    __tablename__ = 'chunks'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey('lgs.documents.id', ondelete='CASCADE'), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    content_hash = Column(Text, nullable=False)
    start_offset = Column(Integer, nullable=False)
    end_offset = Column(Integer, nullable=False)
    token_count = Column(Integer, nullable=False)
    embedding = Column(HALFVEC(1024), nullable=False)
    embedding_model = Column(Text, nullable=False)
    embedding_dimensions = Column(Integer, nullable=False)
    search_vector = Column(TSVECTOR, Computed("to_tsvector('simple', content)", persisted=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index('chunks_document_idx', 'document_id'),
        Index('chunks_embedding_idx', 'embedding', postgresql_using='hnsw', postgresql_with={'m': 16, 'ef_construction': 64}, postgresql_ops={'embedding': 'halfvec_cosine_ops'}),
        Index('chunks_search_idx', 'search_vector', postgresql_using='gin'),
        {"schema": "lgs"}
    )

class Term(LGSBase):
    __tablename__ = 'terms'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False, server_default='')
    collection_id = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    normalized_text = Column(Text, nullable=False)
    label = Column(Text, nullable=False)
    status = Column(term_status_enum, server_default='raw', nullable=False)
    merged_into_id = Column(UUID(as_uuid=True), ForeignKey('lgs.terms.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint('tenant_id', 'collection_id', 'normalized_text', 'label', name='terms_unique'),
        {"schema": "lgs"}
    )

class ChunkTerm(LGSBase):
    __tablename__ = 'chunk_terms'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey('lgs.chunks.id', ondelete='CASCADE'), nullable=False)
    term_id = Column(UUID(as_uuid=True), ForeignKey('lgs.terms.id', ondelete='CASCADE'), nullable=False)
    source = Column(Text, nullable=False)
    label = Column(Text, nullable=False)
    start_offset = Column(Integer, nullable=False)
    end_offset = Column(Integer, nullable=False)
    confidence_score = Column(Float, nullable=True)
    refined_by = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint('chunk_id', 'term_id', 'start_offset', 'end_offset', 'label', name='chunk_terms_span_unique'),
        Index('chunk_terms_chunk_idx', 'chunk_id'),
        Index('chunk_terms_term_idx', 'term_id'),
        {"schema": "lgs"}
    )

class TermCooccurrence(LGSBase):
    __tablename__ = 'term_cooccurrences'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id = Column(String, nullable=False)
    term_a_id = Column(UUID(as_uuid=True), ForeignKey('lgs.terms.id', ondelete='CASCADE'), nullable=False)
    term_b_id = Column(UUID(as_uuid=True), ForeignKey('lgs.terms.id', ondelete='CASCADE'), nullable=False)
    cooccurrence_count = Column(Integer, server_default='1', nullable=False)
    weight = Column(Float, server_default='1.0', nullable=False)

    __table_args__ = (
        UniqueConstraint('collection_id', 'term_a_id', 'term_b_id', name='term_cooccurrences_collection_id_term_a_id_term_b_id_unique'),
        {"schema": "lgs"}
    )

class TermCooccurrenceChunk(LGSBase):
    __tablename__ = 'term_cooccurrence_chunks'

    cooccurrence_id = Column(UUID(as_uuid=True), ForeignKey('lgs.term_cooccurrences.id', ondelete='CASCADE'), primary_key=True)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey('lgs.chunks.id', ondelete='CASCADE'), primary_key=True)

class GraphRefinementProposal(LGSBase):
    __tablename__ = 'graph_refinement_proposals'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id = Column(String, nullable=False)
    proposal_type = Column(String(255), nullable=False)
    target_type = Column(String(255), nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=False)
    payload = Column(JSONB, nullable=False)
    rationale = Column(Text, nullable=True)
    status = Column(String(255), server_default='pending', nullable=False)
    created_by_agent = Column(String(255), nullable=True)
    reviewed_by = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

class GraphMutationEvent(LGSBase):
    __tablename__ = 'graph_mutation_events'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id = Column(String, nullable=False)
    proposal_id = Column(UUID(as_uuid=True), ForeignKey('lgs.graph_refinement_proposals.id', ondelete='SET NULL'), nullable=True)
    mutation_type = Column(String(255), nullable=False)
    target_type = Column(String(255), nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=False)
    actor_type = Column(String(50), nullable=False)
    actor_id = Column(Text, nullable=False)
    before_snapshot = Column(JSONB, nullable=True)
    after_snapshot = Column(JSONB, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Community(LGSBase):
    __tablename__ = 'communities'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id = Column(String, nullable=False)
    level = Column(Integer, nullable=False)
    parent_community_id = Column(UUID(as_uuid=True), ForeignKey('lgs.communities.id', ondelete='SET NULL'), nullable=True)
    algorithm = Column(String(255), nullable=False)
    algorithm_version = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        {"schema": "lgs"}
    )

class TermCommunityMembership(LGSBase):
    __tablename__ = 'term_community_memberships'

    community_id = Column(UUID(as_uuid=True), ForeignKey('lgs.communities.id', ondelete='CASCADE'), primary_key=True)
    term_id = Column(UUID(as_uuid=True), ForeignKey('lgs.terms.id', ondelete='CASCADE'), primary_key=True)
    membership_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        {"schema": "lgs"}
    )

class RetrievalTrace(LGSBase):
    __tablename__ = 'retrieval_traces'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False, server_default='')
    collection_id = Column(String, nullable=False)
    query = Column(Text, nullable=False)
    expanded_query = Column(Text, nullable=True)
    budget_preset = Column(String(50), nullable=False)
    relevance_test_budget = Column(Integer, nullable=False)
    subquery_count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        {"schema": "lgs"}
    )

class RetrievalTraceStep(LGSBase):
    __tablename__ = 'retrieval_trace_steps'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trace_id = Column(UUID(as_uuid=True), ForeignKey('lgs.retrieval_traces.id', ondelete='CASCADE'), nullable=False)
    step_type = Column(String(50), nullable=False)
    payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        {"schema": "lgs"}
    )
