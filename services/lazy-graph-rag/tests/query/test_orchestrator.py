import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.query.orchestrator import QueryOrchestrator
from app.query.models import RetrievedContext



@pytest.mark.anyio
@patch("app.query.orchestrator.HybridSearcher")
async def test_orchestrator_hybrid_packs_contexts_and_calls_generator(mock_searcher_class):
    mock_searcher = AsyncMock()
    mock_searcher.search.return_value = {
        "results": [
            {"chunk_id": "c1", "document_id": "d1", "content": "hello world", "score": 0.9}
        ],
        "trace": {"lexical_count": 1}
    }
    mock_searcher_class.return_value = mock_searcher
    
    # We use test_mode=True to use the DeterministicTestGenerator
    orchestrator = QueryOrchestrator(session=AsyncMock(), test_mode=True)
    
    # Mock the packer to ensure we verify its involvement
    orchestrator.packer = MagicMock()
    packed_ctx = RetrievedContext(
        chunkId="c1", documentId="d1", content="hello world", score=0.9, startOffset=0, endOffset=11
    )
    orchestrator.packer.pack.return_value = ([packed_ctx], [])
    
    # Mock generator to verify it receives packed contexts
    orchestrator.generator = MagicMock()
    orchestrator.generator.generate_answer.return_value = "Mock answer"

    result = await orchestrator.execute_query(
        tenant_id="t1", 
        collection_id="c1", 
        query="What is it?", 
        budget_preset="lite", 
        retrieval_mode="hybrid"
    )

    assert result["answer"] == "Mock answer"
    assert len(result["contexts"]) == 1
    assert result["contexts"][0]["chunkId"] == "c1"
    
    # Verify searcher called
    mock_searcher.search.assert_called_once_with(
        tenant_id="t1",
        collection_id="c1",
        query="What is it?",
        top_k=8,
        retrieval_mode="hybrid"
    )
    
    # Verify packer called
    orchestrator.packer.pack.assert_called_once()
    
    # Verify generator called with packed contexts
    orchestrator.generator.generate_answer.assert_called_once_with("What is it?", [packed_ctx])


@pytest.mark.anyio
@patch("app.query.orchestrator.LazyGraphSearcher")
async def test_orchestrator_map_reduce_flow(mock_searcher_class):
    mock_searcher = AsyncMock()
    mock_searcher.search.return_value = {
        "results": [
            {"chunk_id": "c1", "document_id": "d1", "content": "hello world", "score": 0.9, "start_offset": 0, "end_offset": 11}
        ],
        "claims": [
            {"claim": "Claim from subquery 1", "chunk_ids": ["c1"], "subquery": "subquery 1"},
            {"claim": "Claim from subquery 2", "chunk_ids": ["c1"], "subquery": "subquery 2"}
        ],
        "subqueries": ["subquery 1", "subquery 2"],
        "trace": {"steps": ["query_refinement"]}
    }
    mock_searcher_class.return_value = mock_searcher

    orchestrator = QueryOrchestrator(session=AsyncMock(), test_mode=True)
    orchestrator.generator = MagicMock()
    orchestrator.generator.generate_partial_answer.side_effect = [
        "Partial answer 1",
        "Partial answer 2"
    ]
    orchestrator.generator.reduce_answers.return_value = "Cohesive final answer"

    result = await orchestrator.execute_query(
        tenant_id="t1",
        collection_id="c1",
        query="What is it?",
        budget_preset="balanced",
        retrieval_mode="graph_balanced"
    )

    assert result["answer"] == "Cohesive final answer"
    assert orchestrator.generator.generate_partial_answer.call_count == 2
    orchestrator.generator.reduce_answers.assert_called_once_with("What is it?", ["Partial answer 1", "Partial answer 2"])
    
    # Check trace steps
    steps = [s["action"] for s in result["trace"]["steps"]]
    assert "map_reduce_synthesis" in steps
