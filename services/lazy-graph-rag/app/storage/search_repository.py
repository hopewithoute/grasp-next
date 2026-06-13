from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.storage.models import Document, Chunk
from app.storage.tenant import normalize_tenant_id

class SearchRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def lexical_search(self, tenant_id: Optional[str], collection_id: str, query: str, top_k: int = 50) -> List[str]:
        normalized_tenant_id = normalize_tenant_id(tenant_id)
        # websearch_to_tsquery('simple', query)
        tsquery = func.websearch_to_tsquery('simple', query)
        
        stmt = (
            select(Chunk.id)
            .join(Document, Chunk.document_id == Document.id)
            .where(Document.collection_id == collection_id)
            .where(Document.tenant_id == normalized_tenant_id)
            .where(Chunk.search_vector.op('@@')(tsquery))
        )
            
        # Order by rank
        rank_func = func.ts_rank(Chunk.search_vector, tsquery)
        stmt = stmt.order_by(rank_func.desc()).limit(top_k)
        
        result = await self.session.execute(stmt)
        return [str(row[0]) for row in result.all()]

    async def vector_search(self, tenant_id: Optional[str], collection_id: str, query_embedding: List[float], top_k: int = 50) -> List[str]:
        normalized_tenant_id = normalize_tenant_id(tenant_id)
        stmt = (
            select(Chunk.id)
            .join(Document, Chunk.document_id == Document.id)
            .where(Document.collection_id == collection_id)
            .where(Document.tenant_id == normalized_tenant_id)
        )
            
        # Order by cosine distance
        distance_func = Chunk.embedding.cosine_distance(query_embedding)
        stmt = stmt.order_by(distance_func).limit(top_k)
        
        result = await self.session.execute(stmt)
        return [str(row[0]) for row in result.all()]

    async def get_chunks_by_ids(self, chunk_ids: List[str]) -> List[Dict[str, Any]]:
        if not chunk_ids:
            return []
            
        stmt = (
            select(Chunk, Document)
            .join(Document, Chunk.document_id == Document.id)
            .where(Chunk.id.in_(chunk_ids))
        )
        result = await self.session.execute(stmt)
        
        chunk_map = {
            str(chunk.id): {
                "chunk_id": str(chunk.id),
                "document_id": str(doc.id),
                "source_id": doc.source_id,
                "document_name": doc.document_name,
                "content": chunk.content,
                "start_offset": chunk.start_offset,
                "end_offset": chunk.end_offset,
            }
            for chunk, doc in result
        }
        return [chunk_map[cid] for cid in chunk_ids if cid in chunk_map]
