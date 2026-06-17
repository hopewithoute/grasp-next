import uuid
from typing import Dict, Tuple, Set
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, insert
from sqlalchemy.orm import selectinload

from app.storage.models import (
    Document,
    Chunk,
    Term,
    ChunkTerm,
    TermCooccurrence,
    TermCooccurrenceChunk
)

class CooccurrenceBuilder:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def build_for_collection(self, collection_id: str):
        """
        Rebuild term co-occurrences for an entire collection.
        This deletes existing co-occurrences and rebuilds them from chunk_terms.
        """
        await self._clear_existing_cooccurrences(collection_id)
        
        chunk_to_terms = await self._fetch_grouped_chunk_terms(collection_id)
        if not chunk_to_terms:
            return 0
            
        pair_to_chunks = self._generate_term_pairs(chunk_to_terms)
        if not pair_to_chunks:
            return 0
            
        cooccurrence_ids = await self._insert_cooccurrences(collection_id, pair_to_chunks)
        await self._insert_cooccurrence_chunks(pair_to_chunks, cooccurrence_ids)
            
        return len(cooccurrence_ids)

    async def _clear_existing_cooccurrences(self, collection_id: str):
        # TermCooccurrenceChunk will be cascade deleted.
        await self.session.execute(
            delete(TermCooccurrence)
            .where(TermCooccurrence.collection_id == collection_id)
        )

    async def _fetch_grouped_chunk_terms(self, collection_id: str) -> Dict[uuid.UUID, Set[uuid.UUID]]:
        stmt = (
            select(ChunkTerm.chunk_id, ChunkTerm.term_id)
            .join(Term, ChunkTerm.term_id == Term.id)
            .where(Term.collection_id == collection_id)
        )
        result = await self.session.execute(stmt)
        
        chunk_to_terms = defaultdict(set)
        for row in result:
            chunk_to_terms[row.chunk_id].add(row.term_id)
        return chunk_to_terms

    def _generate_term_pairs(self, chunk_to_terms: Dict[uuid.UUID, Set[uuid.UUID]]) -> Dict[Tuple[uuid.UUID, uuid.UUID], Set[uuid.UUID]]:
        pair_to_chunks = defaultdict(set)
        for chunk_id, terms in chunk_to_terms.items():
            terms_list = sorted(list(terms))
            for i in range(len(terms_list)):
                for j in range(i + 1, len(terms_list)):
                    pair_to_chunks[(terms_list[i], terms_list[j])].add(chunk_id)
        return pair_to_chunks

    async def _insert_cooccurrences(self, collection_id: str, pair_to_chunks: Dict) -> Dict[Tuple[uuid.UUID, uuid.UUID], uuid.UUID]:
        cooccurrence_data = []
        cooccurrence_ids = {}
        
        for (term_a, term_b), chunks in pair_to_chunks.items():
            cid = uuid.uuid4()
            cooccurrence_ids[(term_a, term_b)] = cid
            count = len(chunks)
            cooccurrence_data.append({
                "id": cid,
                "collection_id": collection_id,
                "term_a_id": term_a,
                "term_b_id": term_b,
                "cooccurrence_count": count,
                "weight": float(count)
            })
            
        if cooccurrence_data:
            await self.session.execute(insert(TermCooccurrence), cooccurrence_data)
            
        return cooccurrence_ids

    async def _insert_cooccurrence_chunks(self, pair_to_chunks: Dict, cooccurrence_ids: Dict):
        tcc_data = []
        for (term_a, term_b), chunks in pair_to_chunks.items():
            cid = cooccurrence_ids[(term_a, term_b)]
            for chunk_id in chunks:
                tcc_data.append({
                    "cooccurrence_id": cid,
                    "chunk_id": chunk_id
                })
                
        if tcc_data:
            # Batch insert to avoid huge memory spikes
            await self.session.execute(insert(TermCooccurrenceChunk), tcc_data)
