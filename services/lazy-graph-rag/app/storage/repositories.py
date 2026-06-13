from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
import uuid
from app.storage.models import (
    Document,
    Chunk,
    Term,
    ChunkTerm,
    GraphMutationEvent,
    GraphRefinementProposal,
)
from app.storage.tenant import normalize_tenant_id

class SourceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_document_by_source(self, tenant_id: Optional[str], collection_id: str, source_id: str) -> Optional[Document]:
        normalized_tenant_id = normalize_tenant_id(tenant_id)
        stmt = select(Document).where(
            Document.collection_id == collection_id,
            Document.source_id == source_id,
            Document.tenant_id == normalized_tenant_id
        )
            
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def delete_document_by_source(self, tenant_id: Optional[str], collection_id: str, source_id: str):
        normalized_tenant_id = normalize_tenant_id(tenant_id)
        # Chunks and chunk_terms cascade delete
        stmt = delete(Document).where(
            Document.collection_id == collection_id,
            Document.source_id == source_id,
            Document.tenant_id == normalized_tenant_id
        )
        result = await self.session.execute(stmt)
        return result.rowcount or 0

    async def delete_collection(self, tenant_id: Optional[str], collection_id: str):
        normalized_tenant_id = normalize_tenant_id(tenant_id)
        await self.session.execute(
            delete(GraphMutationEvent).where(GraphMutationEvent.collection_id == collection_id)
        )
        await self.session.execute(
            delete(GraphRefinementProposal).where(GraphRefinementProposal.collection_id == collection_id)
        )

        stmt = delete(Document).where(
            Document.collection_id == collection_id,
            Document.tenant_id == normalized_tenant_id,
        )

        result = await self.session.execute(stmt)
        await self.cleanup_orphan_terms(tenant_id, collection_id)
        return result.rowcount or 0

    async def cleanup_orphan_terms(self, tenant_id: Optional[str], collection_id: str):
        normalized_tenant_id = normalize_tenant_id(tenant_id)
        # Delete terms in this collection that have no associated chunk_terms
        # and aren't involved in cooccurrences (though for this spike we might just check chunk_terms)
        stmt = delete(Term).where(
            Term.collection_id == collection_id,
            Term.tenant_id == normalized_tenant_id,
            ~Term.id.in_(select(ChunkTerm.term_id))
        )
        await self.session.execute(stmt)

    async def save_indexed_source(self, 
                                  document_data: Dict[str, Any], 
                                  chunks_data: List[Dict[str, Any]], 
                                  terms_data: List[Dict[str, Any]], 
                                  chunk_terms_data: List[Dict[str, Any]]) -> str:
        # 1. Insert Document
        doc_id = uuid.uuid4()
        document_data["id"] = doc_id
        doc = Document(**document_data)
        self.session.add(doc)

        # 2. Insert Chunks
        chunks_data = [{**c, "document_id": doc_id} for c in chunks_data]
        
        if chunks_data:
            await self.session.execute(insert(Chunk), chunks_data)

        # 3. Upsert Terms
        term_id_map = {} # normalized_text+label -> term_id
        if terms_data:
            # PostgreSQL UPSERT
            stmt = pg_insert(Term).values(terms_data)
            stmt = stmt.on_conflict_do_update(
                constraint='terms_unique',
                set_={'updated_at': stmt.excluded.updated_at}
            ).returning(Term.id, Term.normalized_text, Term.label)
            
            result = await self.session.execute(stmt)
            term_id_map = {f"{row.normalized_text}:::{row.label}": row.id for row in result}

        # 4. Insert ChunkTerms
        chunk_terms_data = [
            {
                **{k: v for k, v in ct.items() if not k.startswith('_')},
                "term_id": term_id_map[f"{ct['_normalized_text']}:::{ct['_label']}"]
            }
            for ct in chunk_terms_data
        ]
            
        if chunk_terms_data:
            # Need to handle potential duplicate chunk-term spans? Usually just ignore or do update
            stmt = pg_insert(ChunkTerm).values(chunk_terms_data)
            stmt = stmt.on_conflict_do_nothing()
            await self.session.execute(stmt)

        return str(doc_id)
