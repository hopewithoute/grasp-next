import uuid
import heapq
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert

from app.retrieval.hybrid import HybridSearcher
from app.storage.models import RetrievalTrace, RetrievalTraceStep
from app.storage.search_repository import SearchRepository
from app.query.relevance_tester import RelevanceTester
from app.query.query_decomposer import QueryDecomposer
from app.query.claim_extractor import ClaimExtractor
from app.query.generator import create_generator

class LazyGraphSearcher:
    def __init__(self, session: AsyncSession, test_mode: bool = False):
        self.session = session
        self.hybrid_searcher = HybridSearcher(session)
        self.test_mode = test_mode
        # Share a single generator across all sub-components
        generator = create_generator(force_test=test_mode)
        self.decomposer = QueryDecomposer(generator=generator, test_mode=test_mode)
        self.claim_extractor = ClaimExtractor(generator=generator, test_mode=test_mode)
        self._shared_generator = generator

    async def search(self, tenant_id: Optional[str], collection_id: str, query: str, budget_preset: str = "balanced") -> Dict[str, Any]:
        """
        Execute Budgeted Lazy Retrieval according to LazyGraphRAG.
        """
        budget = self._get_budget(budget_preset)
        trace_id = uuid.uuid4()
        
        trace_record = self._create_initial_trace_record(trace_id, tenant_id, collection_id, query, budget_preset, budget)
        await self.session.execute(insert(RetrievalTrace).values([trace_record]))
        
        steps = []
        def add_step(step_type: str, payload: Dict[str, Any]):
            steps.append({"trace_id": trace_id, "step_type": step_type, "payload": payload})

        # 1. Query Refinement
        subqueries = self.decomposer.decompose(query, budget["maxSubqueries"])
        trace_record["subquery_count"] = len(subqueries)
        add_step("query_refinement", {"original": query, "subqueries": subqueries})

        all_results = []
        existing_chunk_ids = set()
        
        search_repo = SearchRepository(self.session)
        tester = RelevanceTester(test_mode=self.test_mode, generator=self._shared_generator)

        budget_state = {
            "remaining": budget["relevanceTestBudget"],
            "all_claims": []
        }

        for sq in subqueries:
            if budget_state["remaining"] <= 0 and budget_preset != "lite":
                break
            await self._process_subquery(
                tenant_id, collection_id, sq, budget_preset, budget_state,
                search_repo, tester, all_results, existing_chunk_ids, add_step
            )

        if steps:
            await self.session.execute(insert(RetrievalTraceStep).values(steps))
            
        return {
            "results": all_results,
            "claims": [c.model_dump() for c in budget_state["all_claims"]],
            "subqueries": subqueries,
            "trace": {
                "trace_id": str(trace_id),
                "budget_preset": budget_preset,
                "steps": [s["step_type"] for s in steps]
            }
        }

    def _get_budget(self, preset: str) -> Dict[str, int]:
        budgets = {
            "lite": {"relevanceTestBudget": 0, "maxSubqueries": 1},
            "balanced": {"relevanceTestBudget": 5, "maxSubqueries": 3},
            "deep": {"relevanceTestBudget": 10, "maxSubqueries": 5}
        }
        return budgets.get(preset, budgets["balanced"])

    def _create_initial_trace_record(self, trace_id, tenant_id, collection_id, query, budget_preset, budget):
        return {
            "id": trace_id,
            "tenant_id": tenant_id or "",
            "collection_id": collection_id,
            "query": query,
            "expanded_query": None,
            "budget_preset": budget_preset,
            "relevance_test_budget": budget["relevanceTestBudget"],
            "subquery_count": 0
        }

    async def _process_subquery(self, tenant_id, collection_id, sq, budget_preset, budget_state,
                                search_repo, tester, all_results, existing_chunk_ids, add_step):
        # 1. Seed Search
        seed_results = await self.hybrid_searcher.search(tenant_id, collection_id, sq, top_k=10)
        add_step("seed_chunk", {"subquery": sq, "chunks": seed_results["results"][:3]})
        
        self._merge_results(seed_results["results"], all_results, existing_chunk_ids)
        
        if budget_preset == "lite" or not seed_results["results"]:
            return
            
        # 2. Community Ranking
        pq = await self._rank_communities(seed_results["results"], search_repo, add_step, sq)
        
        # 3. Relevance Test & Iterative Deepening
        await self._explore_communities(
            sq, pq, budget_state, search_repo, tester, 
            all_results, existing_chunk_ids, add_step
        )

    def _merge_results(self, new_chunks, all_results, existing_chunk_ids):
        for c in new_chunks:
            if c["chunk_id"] not in existing_chunk_ids:
                all_results.append(c)
                existing_chunk_ids.add(c["chunk_id"])

    async def _rank_communities(self, seed_results, search_repo, add_step, sq):
        seed_chunk_ids = [c["chunk_id"] for c in seed_results]
        community_links = await search_repo.get_communities_for_chunks(seed_chunk_ids)
        
        chunk_scores = {c["chunk_id"]: c.get("score", 1.0) for c in seed_results}
        community_scores = {}
        for link in community_links:
            cid = link["community_id"]
            c_score = chunk_scores.get(link["chunk_id"], 1.0) * (link["score"] or 1.0)
            community_scores[cid] = community_scores.get(cid, 0.0) + c_score
            
        pq = []
        for cid, score in community_scores.items():
            heapq.heappush(pq, (-score, cid))
            
        candidate_communities = [{"community_id": cid, "score": score} for cid, score in sorted(community_scores.items(), key=lambda x: x[1], reverse=True)]
        add_step("community_rank", {"subquery": sq, "ranked_communities": candidate_communities[:10]})
        return pq

    async def _explore_communities(self, sq, pq, budget_state, search_repo, tester, 
                                   all_results, existing_chunk_ids, add_step):
        explored_communities = set()
        
        while pq and budget_state["remaining"] > 0:
            neg_score, current_cid = heapq.heappop(pq)
            if current_cid in explored_communities:
                continue
            explored_communities.add(current_cid)
            
            comm_chunks = await search_repo.get_chunks_in_community(current_cid)
            if not comm_chunks:
                continue
                
            chunks_to_test = comm_chunks[:budget_state["remaining"]]
            budget_state["remaining"] -= len(chunks_to_test)
            
            relevant_chunks = tester.test_chunks_batch(sq, chunks_to_test, len(chunks_to_test))
            add_step("relevance_test", {"community_id": current_cid, "tested_chunks": len(chunks_to_test), "relevant": len(relevant_chunks)})
            
            if relevant_chunks:
                await self._process_relevant_community(
                    sq, current_cid, neg_score, pq, explored_communities, 
                    relevant_chunks, search_repo, all_results, existing_chunk_ids, add_step, budget_state
                )
            else:
                add_step("descent", {"community_id": current_cid, "descend": False, "reason": "Not enough relevant chunks"})

    async def _process_relevant_community(self, sq, current_cid, neg_score, pq, explored_communities, 
                                          relevant_chunks, search_repo, all_results, existing_chunk_ids, add_step, budget_state):
        # Deepening: get sub-communities
        sub_cids = await search_repo.get_sub_communities(current_cid)
        if sub_cids:
            add_step("descent", {"community_id": current_cid, "descend": True, "sub_communities": len(sub_cids)})
            for sub_cid in sub_cids:
                if sub_cid not in explored_communities:
                    inherited_score = (-neg_score) * 0.9 
                    heapq.heappush(pq, (-inherited_score, sub_cid))
        else:
            add_step("descent", {"community_id": current_cid, "descend": False, "reason": "No sub-communities"})
            
        # Query-Time Claim Extraction
        extracted_claims = self.claim_extractor.extract_claims(sq, relevant_chunks)
        budget_state["all_claims"].extend(extracted_claims)
        
        claims_trace = [{"claim": c.claim, "chunk_id": cid} for c in extracted_claims for cid in c.chunk_ids]
        add_step("claim", {"subquery": sq, "claims": claims_trace})
        
        self._merge_results(relevant_chunks, all_results, existing_chunk_ids)
