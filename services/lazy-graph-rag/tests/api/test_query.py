import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.storage.db import get_db_session

AUTH_HEADERS = {"Authorization": "Bearer local-dev-key"}

class FakeSession:
    async def commit(self):
        return None

@pytest.fixture
def override_get_db():
    async def _override():
        yield FakeSession()
    app.dependency_overrides[get_db_session] = _override
    yield
    app.dependency_overrides.clear()

from unittest.mock import patch, MagicMock

@pytest.mark.anyio
async def test_query_endpoint(override_get_db):
    mock_result = {
        "answer": "This is a mock answer.",
        "contexts": [
            {
                "documentId": "doc-1",
                "chunkId": "chunk-1",
                "content": "Sample context.",
                "score": 0.9,
                "label": "topic",
                "startOffset": 0,
                "endOffset": 15
            }
        ],
        "citations": [
            {
                "chunkId": "chunk-1",
                "documentId": "doc-1",
                "startOffset": 0,
                "endOffset": 15
            }
        ],
        "trace": {
            "budgetPreset": "lite",
            "steps": [{"action": "mock_retrieval"}]
        }
    }

    async def fake_execute(*args, **kwargs):
        return mock_result

    class FakeOrchestrator:
        def __init__(self, session):
            self.session = session

        async def execute_query(self, *args, **kwargs):
            return await fake_execute(*args, **kwargs)

    with patch("app.api.query.QueryOrchestrator", new=FakeOrchestrator):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                "/v1/query",
                json={
                    "collectionId": "test-collection",
                    "query": "What is mock?",
                    "topK": 5
                },
                headers=AUTH_HEADERS
            )

        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == "This is a mock answer."
        assert len(data["contexts"]) == 1
        assert len(data["citations"]) == 1
        assert data["trace"] == {
            "budgetPreset": "lite",
            "steps": [{"action": "mock_retrieval"}]
        }
