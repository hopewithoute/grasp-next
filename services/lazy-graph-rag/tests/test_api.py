from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from app.main import app
from app.storage.db import get_db_session
import pytest

client = TestClient(app)
AUTH_HEADERS = {"Authorization": "Bearer local-dev-key"}


@pytest.fixture(autouse=True)
def override_db_session():
    async def fake_db_session():
        yield AsyncMock()

    app.dependency_overrides[get_db_session] = fake_db_session
    yield
    app.dependency_overrides.clear()

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_metadata():
    response = client.get("/metadata")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "lazy-graph-rag"
    assert "gliner_model" in data
    assert "embedding_model" in data
    assert "embedding_dimensions" in data


def test_lgs_api_key_is_required_when_configured(monkeypatch):
    monkeypatch.setenv("LGS_API_KEY", "secret-key")

    response = client.post("/v1/search", json={
        "tenantId": "t1",
        "collectionId": "c1",
        "query": "hello world",
        "topK": 5
    })

    assert response.status_code == 401

@patch('app.api.sources.SourceIndexer')
def test_index_source(mock_indexer_class):
    mock_indexer = AsyncMock()
    mock_indexer.index_source.return_value = {
        "status": "indexed",
        "documentId": "doc-uuid",
        "chunkCount": 3,
        "termCount": 10,
        "chunkTermCount": 15,
        "contentHash": "abcd123"
    }
    mock_indexer_class.return_value = mock_indexer

    payload = {
        "tenantId": "t1",
        "collectionId": "c1",
        "sourceId": "s1",
        "sourceType": "markdown",
        "documentName": "Doc 1",
        "content": "# Title\n\nBody",
        "contentUri": None,
        "contentMetadata": {}
    }

    response = client.post("/v1/sources/index", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "indexed"
    assert data["documentId"] == "doc-uuid"
    assert data["chunkCount"] == 3
    assert "glinerModel" not in data
    assert "embeddingModel" not in data
    assert "embeddingModelPath" not in data
    mock_indexer.index_source.assert_called_once()


@patch('app.api.sources.SourceRepository')
def test_delete_source(mock_repo_class):
    mock_repo = AsyncMock()
    mock_repo.delete_document_by_source.return_value = 1
    mock_repo_class.return_value = mock_repo

    payload = {
        "tenantId": "t1",
        "collectionId": "c1",
        "sourceId": "s1"
    }

    response = client.post("/v1/sources/delete", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json() == {
        "status": "deleted",
        "deletedDocumentCount": 1
    }
    mock_repo.delete_document_by_source.assert_called_once_with(
        tenant_id="t1",
        collection_id="c1",
        source_id="s1",
    )
    mock_repo.cleanup_orphan_terms.assert_called_once_with("t1", "c1")


@patch('app.api.collections.SourceRepository')
def test_delete_collection(mock_repo_class):
    mock_repo = AsyncMock()
    mock_repo.delete_collection.return_value = 2
    mock_repo_class.return_value = mock_repo

    payload = {
        "tenantId": "t1",
        "collectionId": "c1",
    }

    response = client.post("/v1/collections/delete", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json() == {
        "status": "deleted",
        "deletedDocumentCount": 2
    }
    mock_repo.delete_collection.assert_called_once_with(
        tenant_id="t1",
        collection_id="c1",
    )

@patch('app.api.search.HybridSearcher')
def test_search(mock_searcher_class):
    mock_searcher = AsyncMock()
    mock_searcher.search.return_value = {
        "results": [{"chunk_id": "c1", "score": 0.9}],
        "trace": {"lexical_count": 1, "vector_count": 1, "rrf_pool_size": 1}
    }
    mock_searcher_class.return_value = mock_searcher

    payload = {
        "tenantId": "t1",
        "collectionId": "c1",
        "query": "hello world",
        "topK": 5
    }

    response = client.post("/v1/search", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["chunk_id"] == "c1"
    assert "glinerModel" not in data["trace"]
    assert "embeddingModel" not in data["trace"]
    assert "embeddingModelPath" not in data["trace"]
    
    mock_searcher.search.assert_called_once_with(
        tenant_id="t1",
        collection_id="c1",
        query="hello world",
        top_k=5
    )
