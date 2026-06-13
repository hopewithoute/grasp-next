import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.retrieval.hybrid import HybridSearcher
from app.retrieval.rrf import compute_rrf

def test_compute_rrf():
    lexical = ["chunk_a", "chunk_b", "chunk_c"]
    vector = ["chunk_b", "chunk_d", "chunk_a"]
    
    # K=60
    # chunk_a: 1/61 + 1/63
    # chunk_b: 1/62 + 1/61
    # chunk_c: 1/63
    # chunk_d: 1/62
    
    results = compute_rrf([lexical, vector], k=60)
    assert len(results) == 4
    
    # b should have highest score: (1/62 + 1/61)
    assert results[0]["chunk_id"] == "chunk_b"
    
    # a should have next highest score: (1/61 + 1/63)
    assert results[1]["chunk_id"] == "chunk_a"

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@patch('app.retrieval.hybrid.SearchRepository')
@patch('app.retrieval.hybrid.create_embedding_runtime')
@pytest.mark.anyio
async def test_hybrid_search(mock_embedding_factory, mock_repo_class):
    mock_repo = AsyncMock()
    mock_repo.lexical_search.return_value = ["c1", "c2"]
    mock_repo.vector_search.return_value = ["c2", "c3"]
    all_chunks = {
        "c1": {"chunk_id": "c1", "content": "hello 1"},
        "c2": {"chunk_id": "c2", "content": "hello 2"},
        "c3": {"chunk_id": "c3", "content": "hello 3"},
    }
    mock_repo.get_chunks_by_ids.side_effect = lambda ids: [all_chunks[i] for i in ids if i in all_chunks]
    mock_repo_class.return_value = mock_repo
    
    mock_embedder = MagicMock()
    mock_embedder.create_embeddings.return_value = [[0.2]*1024]
    mock_embedding_factory.return_value = mock_embedder
    
    mock_session = AsyncMock()
    
    searcher = HybridSearcher(mock_session)
    result = await searcher.search(
        tenant_id="t1",
        collection_id="proj-1",
        query="test query",
        top_k=2
    )
    
    assert len(result["results"]) == 2
    
    # c2 is in both, so it should be rank 1
    assert result["results"][0]["chunk_id"] == "c2"
    assert "score" in result["results"][0]
    
    assert result["trace"]["lexical_count"] == 2
    assert result["trace"]["vector_count"] == 2
    assert result["trace"]["rrf_pool_size"] == 3


@patch('app.retrieval.hybrid.SearchRepository')
@patch('app.retrieval.hybrid.create_embedding_runtime')
@pytest.mark.anyio
async def test_hybrid_search_uses_configured_embedding_dimensions(
    mock_embedding_factory,
    mock_repo_class,
    monkeypatch,
):
    monkeypatch.setenv("EMBEDDING_DIMENSIONS", "3")

    mock_repo = AsyncMock()
    mock_repo.lexical_search.return_value = []
    mock_repo.vector_search.return_value = []
    mock_repo.get_chunks_by_ids.return_value = []
    mock_repo_class.return_value = mock_repo

    mock_embedder = MagicMock()
    mock_embedder.create_embeddings.return_value = [[0.1, 0.2, 0.3]]
    mock_embedding_factory.return_value = mock_embedder

    result = await HybridSearcher(AsyncMock()).search(
        tenant_id="t1",
        collection_id="proj-1",
        query="test query",
        top_k=2,
    )

    assert result["results"] == []
    mock_repo.vector_search.assert_called_once_with("t1", "proj-1", [0.1, 0.2, 0.3], top_k=50)
