import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.retrieval.lazy_search import LazyGraphSearcher
from app.query.models import Claim

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture
def mock_session():
    return AsyncMock()

@patch('app.retrieval.lazy_search.HybridSearcher')
@patch('app.retrieval.lazy_search.SearchRepository')
@patch('app.retrieval.lazy_search.RelevanceTester')
@patch('app.retrieval.lazy_search.QueryDecomposer')
@patch('app.retrieval.lazy_search.ClaimExtractor')
@pytest.mark.anyio
async def test_lazy_graph_searcher_balanced(mock_extractor_class, mock_decomposer_class, mock_tester_class, mock_repo_class, mock_hybrid_searcher_class, mock_session):
    mock_decomposer = MagicMock()
    mock_decomposer.decompose.return_value = ["test query"]
    mock_decomposer.settings = MagicMock()
    mock_decomposer_class.return_value = mock_decomposer

    mock_extractor = MagicMock()
    mock_extractor.extract_claims.return_value = [Claim(claim="test claim", chunk_ids=["c2"], subquery="test query")]
    mock_extractor_class.return_value = mock_extractor

    mock_hybrid = AsyncMock()
    mock_hybrid.search.return_value = {
        "results": [{"chunk_id": "c1", "content": "test chunk"}],
        "trace": {}
    }
    mock_hybrid_searcher_class.return_value = mock_hybrid
    
    mock_repo = AsyncMock()
    mock_repo.get_communities_for_chunks.return_value = [{"community_id": "comm1", "chunk_id": "c1", "score": 1.0}]
    mock_repo.get_chunks_in_community.return_value = [{"chunk_id": "c2", "content": "community chunk"}]
    mock_repo.get_sub_communities.return_value = ["comm2"]
    mock_repo_class.return_value = mock_repo
    
    mock_tester = MagicMock()
    mock_tester.test_chunks_batch.return_value = [{"chunk_id": "c2", "content": "community chunk"}]
    mock_tester_class.return_value = mock_tester
    
    searcher = LazyGraphSearcher(mock_session)
    result = await searcher.search(
        tenant_id="t1",
        collection_id="proj-1",
        query="test query",
        budget_preset="balanced"
    )
    
    assert len(result["results"]) == 2
    assert result["results"][0]["chunk_id"] == "c1"
    assert result["results"][1]["chunk_id"] == "c2"
    assert len(result["claims"]) == 2
    assert result["claims"][0]["claim"] == "test claim"
    assert result["trace"]["budget_preset"] == "balanced"
    
    # Check that trace steps are recorded correctly
    steps = result["trace"]["steps"]
    expected_steps = [
        "query_refinement",
        "seed_chunk",
        "community_rank",
        "relevance_test",
        "descent",
        "claim"
    ]
    for step in expected_steps:
        assert step in steps
        
    # Check that session.execute was called to insert trace and steps
    # Once for Trace, once for TraceSteps
    assert mock_session.execute.call_count == 2


@patch('app.retrieval.lazy_search.HybridSearcher')
@patch('app.retrieval.lazy_search.SearchRepository')
@patch('app.retrieval.lazy_search.RelevanceTester')
@patch('app.retrieval.lazy_search.QueryDecomposer')
@patch('app.retrieval.lazy_search.ClaimExtractor')
@pytest.mark.anyio
async def test_lazy_graph_searcher_multiple_subqueries(mock_extractor_class, mock_decomposer_class, mock_tester_class, mock_repo_class, mock_hybrid_searcher_class, mock_session):
    mock_decomposer = MagicMock()
    mock_decomposer.decompose.return_value = ["subquery 1", "subquery 2"]
    mock_decomposer.settings = MagicMock()
    mock_decomposer_class.return_value = mock_decomposer

    mock_extractor = MagicMock()
    mock_extractor.extract_claims.return_value = []
    mock_extractor_class.return_value = mock_extractor

    mock_hybrid = AsyncMock()
    mock_hybrid.search.side_effect = [
        {"results": [{"chunk_id": "c1", "content": "chunk 1"}], "trace": {}},
        {"results": [{"chunk_id": "c2", "content": "chunk 2"}], "trace": {}}
    ]
    mock_hybrid_searcher_class.return_value = mock_hybrid
    
    mock_repo = AsyncMock()
    mock_repo.get_communities_for_chunks.return_value = []
    mock_repo_class.return_value = mock_repo
    
    mock_tester = MagicMock()
    mock_tester.test_chunks_batch.return_value = []
    mock_tester_class.return_value = mock_tester
    
    searcher = LazyGraphSearcher(mock_session)
    result = await searcher.search(
        tenant_id="t1",
        collection_id="proj-1",
        query="test query",
        budget_preset="balanced"
    )
    
    assert len(result["results"]) == 2
    assert result["results"][0]["chunk_id"] == "c1"
    assert result["results"][1]["chunk_id"] == "c2"
    
    # Verify mock_hybrid.search was called twice with different subqueries
    assert mock_hybrid.search.call_count == 2
    mock_hybrid.search.assert_any_call("t1", "proj-1", "subquery 1", top_k=10)
    mock_hybrid.search.assert_any_call("t1", "proj-1", "subquery 2", top_k=10)
