from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
from app.main import app
from app.storage.db import get_db_session
from app.storage.graph_repository import GraphRepository
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

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@patch('app.api.graph.GraphRepository')
def test_graph_endpoint(mock_repo_class):
    mock_repo = AsyncMock()
    mock_repo.get_local_graph.return_value = {
        "nodes": [{"id": "uuid-1", "data": {"label": "Term1", "type": "PERSON", "status": "raw", "frequency": 1}, "position": {"x": 0, "y": 0}}],
        "edges": [{"id": "uuid-1_uuid-2", "source": "uuid-1", "target": "uuid-2", "data": {"weight": 5}}]
    }
    mock_repo_class.return_value = mock_repo

    response = client.post(
        "/v1/graph/local",
        json={
            "tenantId": "t1",
            "collectionId": "c1",
            "limit": 100
        },
        headers=AUTH_HEADERS,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) == 1
    assert len(data["edges"]) == 1
    mock_repo.get_local_graph.assert_called_once_with(
        tenant_id="t1",
        collection_id="c1",
        limit=100
    )

@pytest.mark.anyio
async def test_graph_repository():
    mock_session = AsyncMock()
    
    # Mock node fetch
    node_mock = MagicMock()
    node_mock.id = "uuid-1"
    node_mock.text = "Term1"
    node_mock.label = "PERSON"
    node_mock.status = "raw"
    node_mock.frequency = 5
    
    # Mock edge fetch
    edge_mock = MagicMock()
    edge_mock.source_id = "uuid-1"
    edge_mock.target_id = "uuid-2"
    edge_mock.weight = 3

    # Session execute is called twice (nodes, then edges)
    async def mock_execute(query, params):
        if "FROM lgs.terms t" in str(query):
            return [node_mock]
        else:
            return [edge_mock]

    mock_session.execute.side_effect = mock_execute

    repo = GraphRepository(mock_session)
    result = await repo.get_local_graph(tenant_id="t1", collection_id="c1")
    
    assert len(result["nodes"]) == 1
    assert result["nodes"][0]["data"]["label"] == "Term1"
    
    assert len(result["edges"]) == 1
    assert result["edges"][0]["data"]["weight"] == 3
