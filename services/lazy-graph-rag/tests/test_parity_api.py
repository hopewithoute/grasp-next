from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import pytest

from app.main import app
from app.storage.db import get_db_session


client = TestClient(app)
AUTH_HEADERS = {"Authorization": "Bearer local-dev-key"}


@pytest.fixture(autouse=True)
def override_db_session():
    async def fake_db_session():
        yield AsyncMock()

    app.dependency_overrides[get_db_session] = fake_db_session
    yield
    app.dependency_overrides.clear()


def test_source_lifecycle_parity_contract():
    tenant_id = "owner-1"
    collection_id = "project-1"
    source_id = "source-1"

    with (
        patch("app.api.sources.SourceIndexer") as indexer_class,
        patch("app.api.search.HybridSearcher") as searcher_class,
        patch("app.api.graph.GraphRepository") as graph_repo_class,
        patch("app.api.sources.SourceRepository") as source_repo_class,
        patch("app.api.collections.SourceRepository") as collection_repo_class,
    ):
        indexer = AsyncMock()
        indexer.index_source.return_value = {
            "status": "indexed",
            "documentId": "doc-1",
            "chunkCount": 1,
            "termCount": 2,
            "chunkTermCount": 2,
            "contentHash": "hash-1",
        }
        indexer_class.return_value = indexer

        searcher = AsyncMock()
        searcher.search.return_value = {
            "results": [
                {
                    "chunk_id": "chunk-1",
                    "document_id": "doc-1",
                    "source_id": source_id,
                    "document_name": "Doc 1",
                    "content": "PostgreSQL supports pgvector.",
                    "start_offset": 0,
                    "end_offset": 29,
                    "score": 0.032,
                    "lexical_rank": 1,
                    "vector_rank": 1,
                }
            ],
            "trace": {
                "lexical_count": 1,
                "vector_count": 1,
                "rrf_pool_size": 1,
                "lexical_chunk_ids": ["chunk-1"],
                "vector_chunk_ids": ["chunk-1"],
            },
        }
        searcher_class.return_value = searcher

        graph_repo = AsyncMock()
        graph_repo.get_local_graph.return_value = {
            "nodes": [
                {
                    "id": "term-1",
                    "data": {
                        "label": "PostgreSQL",
                        "type": "technology",
                        "status": "raw",
                        "frequency": 1,
                    },
                    "position": {"x": 0, "y": 0},
                }
            ],
            "edges": [],
        }
        graph_repo_class.return_value = graph_repo

        source_repo = AsyncMock()
        source_repo.delete_document_by_source.return_value = 1
        source_repo_class.return_value = source_repo

        collection_repo = AsyncMock()
        collection_repo.delete_collection.return_value = 0
        collection_repo_class.return_value = collection_repo

        index_response = client.post(
            "/v1/sources/index",
            json={
                "tenantId": tenant_id,
                "collectionId": collection_id,
                "sourceId": source_id,
                "sourceType": "markdown",
                "documentName": "Doc 1",
                "content": "# PostgreSQL\n\nPostgreSQL supports pgvector.",
            },
            headers=AUTH_HEADERS,
        )
        assert index_response.status_code == 200
        assert index_response.json()["status"] == "indexed"

        search_response = client.post(
            "/v1/search",
            json={
                "tenantId": tenant_id,
                "collectionId": collection_id,
                "query": "pgvector",
                "topK": 5,
            },
            headers=AUTH_HEADERS,
        )
        assert search_response.status_code == 200
        assert search_response.json()["results"][0]["source_id"] == source_id

        graph_response = client.post(
            "/v1/graph/local",
            json={
                "tenantId": tenant_id,
                "collectionId": collection_id,
                "limit": 100,
            },
            headers=AUTH_HEADERS,
        )
        assert graph_response.status_code == 200
        assert graph_response.json()["nodes"][0]["data"]["label"] == "PostgreSQL"

        delete_source_response = client.post(
            "/v1/sources/delete",
            json={
                "tenantId": tenant_id,
                "collectionId": collection_id,
                "sourceId": source_id,
            },
            headers=AUTH_HEADERS,
        )
        assert delete_source_response.status_code == 200
        assert delete_source_response.json()["deletedDocumentCount"] == 1

        delete_collection_response = client.post(
            "/v1/collections/delete",
            json={
                "tenantId": tenant_id,
                "collectionId": collection_id,
            },
            headers=AUTH_HEADERS,
        )
        assert delete_collection_response.status_code == 200

    indexer.index_source.assert_called_once_with(
        tenant_id=tenant_id,
        collection_id=collection_id,
        source_id=source_id,
        source_type="markdown",
        document_name="Doc 1",
        content="# PostgreSQL\n\nPostgreSQL supports pgvector.",
        content_uri=None,
        content_metadata={},
    )
    searcher.search.assert_called_once_with(
        tenant_id=tenant_id,
        collection_id=collection_id,
        query="pgvector",
        top_k=5,
    )
    graph_repo.get_local_graph.assert_called_once_with(
        tenant_id=tenant_id,
        collection_id=collection_id,
        limit=100,
    )
    source_repo.delete_document_by_source.assert_called_once_with(
        tenant_id=tenant_id,
        collection_id=collection_id,
        source_id=source_id,
    )
    collection_repo.delete_collection.assert_called_once_with(
        tenant_id=tenant_id,
        collection_id=collection_id,
    )
