from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.retrieval.hybrid import HybridSearcher
from app.retrieval.lazy_search import LazyGraphSearcher
from app.query.packer import ContextPacker
from app.query.generator import create_generator
from app.query.claim_aggregator import ClaimAggregator
from app.query.models import Claim

class QueryOrchestrator:
    def __init__(self, session: AsyncSession, test_mode: bool = False):
        self.session = session
        self.test_mode = test_mode
        self.generator = create_generator(force_test=test_mode)
        self.packer = ContextPacker()
        self.claim_aggregator = ClaimAggregator()

    async def execute_query(
        self,
        tenant_id: Optional[str],
        collection_id: str,
        query: str,
        top_k: int = 8,
        budget_preset: str = "lite",
        retrieval_mode: str = "hybrid"
    ) -> Dict[str, Any]:
        
        # Validate retrieval_mode
        if retrieval_mode not in ["hybrid", "graph_lite", "graph_balanced", "graph_deep"]:
            raise ValueError(f"Retrieval mode '{retrieval_mode}' is currently unsupported.")
        
        trace_steps = []

        # 1. Retrieval
        trace_steps.append({"action": "retrieval", "budgetPreset": budget_preset})
        if budget_preset == "lite":
            searcher = HybridSearcher(self.session)
            retrieval_result = await searcher.search(
                tenant_id=tenant_id,
                collection_id=collection_id,
                query=query,
                top_k=top_k,
                retrieval_mode=retrieval_mode
            )
        else:
            searcher = LazyGraphSearcher(self.session, test_mode=self.test_mode)
            retrieval_result = await searcher.search(
                tenant_id=tenant_id,
                collection_id=collection_id,
                query=query,
                budget_preset=budget_preset
            )

        chunks = retrieval_result.get("results", [])
        retrieval_trace = retrieval_result.get("trace", {})
        trace_steps.append({"action": "retrieval_complete", "details": retrieval_trace})

        # 2. Context Packing
        packed_contexts, citations = self.packer.pack(chunks)
        trace_steps.append({
            "action": "context_packing", 
            "packed_count": len(packed_contexts)
        })

        # 3. Generation
        if budget_preset != "lite":
            raw_claims = retrieval_result.get("claims", [])
            claims = [Claim(**c) for c in raw_claims]
            subqueries = retrieval_result.get("subqueries", [])
            
            if len(subqueries) > 1:
                partial_answers = []
                for sq in subqueries:
                    sq_claims = [c for c in claims if c.subquery == sq]
                    aggregated_sq_claims = self.claim_aggregator.aggregate(sq_claims)
                    partial_ans = self.generator.generate_partial_answer(sq, aggregated_sq_claims)
                    partial_answers.append(partial_ans)
                
                trace_steps.append({
                    "action": "map_reduce_synthesis",
                    "subqueries_mapped": len(subqueries),
                    "partial_answers_count": len(partial_answers)
                })
                answer = self.generator.reduce_answers(query, partial_answers)
            else:
                aggregated_claims = self.claim_aggregator.aggregate(claims)
                trace_steps.append({
                    "action": "claim_aggregation",
                    "raw_count": len(claims),
                    "aggregated_count": len(aggregated_claims)
                })
                
                sq = subqueries[0] if subqueries else query
                partial_ans = self.generator.generate_partial_answer(sq, aggregated_claims)
                answer = self.generator.reduce_answers(query, [partial_ans])
        else:
            answer = self.generator.generate_answer(query, packed_contexts)
            
        trace_steps.append({"action": "generation_complete"})

        # Build response
        return {
            "answer": answer,
            "contexts": [ctx.model_dump() for ctx in packed_contexts],
            "citations": [cit.model_dump() for cit in citations],
            "trace": {
                "budgetPreset": budget_preset,
                "steps": trace_steps
            }
        }
