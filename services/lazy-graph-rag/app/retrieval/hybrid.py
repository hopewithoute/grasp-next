from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.embedding.factory import create_embedding_runtime
from app.storage.search_repository import SearchRepository
from app.retrieval.rrf import compute_rrf
from app.settings import get_settings

class HybridSearcher:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = SearchRepository(session)
        self.settings = get_settings()
        self.embedder = create_embedding_runtime(self.settings)

    async def search(self, tenant_id: Optional[str], collection_id: str, query: str, top_k: int = 8, retrieval_mode: str = "hybrid") -> Dict[str, Any]:
        # 1. Lexical search
        lexical_results = await self.repo.lexical_search(tenant_id, collection_id, query, top_k=50)

        # 2. Vector search
        # Compute embedding for the query
        embeddings = self.embedder.create_embeddings([query])
        if len(embeddings) != 1:
            raise RuntimeError(f"query_embedding_count_mismatch: expected 1, got {len(embeddings)}")
        query_embedding = embeddings[0]
        if len(query_embedding) != self.settings.EMBEDDING_DIMENSIONS:
            raise RuntimeError(
                f"query_embedding_dimensions_mismatch: expected {self.settings.EMBEDDING_DIMENSIONS}, got {len(query_embedding)}"
            )
        
        vector_results = await self.repo.vector_search(tenant_id, collection_id, query_embedding, top_k=50)

        # 3. RRF Merge
        ranked_lists = [r for r in (lexical_results, vector_results) if r]
            
        rrf_results = compute_rrf(ranked_lists, k=60)
        
        # Take top_k
        top_results = rrf_results[:top_k]
        chunk_ids = [res["chunk_id"] for res in top_results]
        
        # 4. Fetch chunk details
        chunks_data = await self.repo.get_chunks_by_ids(chunk_ids)
        
        # Merge scores into chunks
        score_map = {res["chunk_id"]: res["rrf_score"] for res in top_results}
        lexical_rank_map = {chunk_id: index + 1 for index, chunk_id in enumerate(lexical_results)}
        vector_rank_map = {chunk_id: index + 1 for index, chunk_id in enumerate(vector_results)}
        for chunk in chunks_data:
            chunk_id = chunk["chunk_id"]
            chunk["score"] = score_map.get(chunk_id, 0.0)
            chunk["lexical_rank"] = lexical_rank_map.get(chunk_id)
            chunk["vector_rank"] = vector_rank_map.get(chunk_id)

        return {
            "results": chunks_data,
            "trace": {
                "retrieval_mode": retrieval_mode,
                "lexical_count": len(lexical_results),
                "vector_count": len(vector_results),
                "rrf_pool_size": len(rrf_results),
                "lexical_chunk_ids": lexical_results[:top_k],
                "vector_chunk_ids": vector_results[:top_k],
            }
        }
