"""Integration tests: full API contract against live Postgres."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.integration.conftest import _truncate_tables_sync

client = TestClient(app, headers={"x-api-key": "test-key"})


@pytest.fixture(autouse=True)
def _clean_tables():
    _truncate_tables_sync()
    yield


PROJECT_ID = "00000000-0000-0000-0000-000000000001"
SOURCE_EXT_ID = "00000000-0000-0000-0000-000000000002"


def ingest_sample_text():
    response = client.post(
        "/v1/ingest/source",
        json={
            "tenantId": "tenant-1",
            "projectId": PROJECT_ID,
            "externalSourceId": SOURCE_EXT_ID,
            "title": "Photosynthesis Notes",
            "sourceType": "markdown",
            "text": "# Photosynthesis\n\nPhotosynthesis converts light energy into chemical energy in plants. Chlorophyll captures light.\n\nCellular respiration releases energy from glucose.",
        },
    )
    assert response.status_code == 200
    return response.json()


class TestIngestSource:
    def test_creates_run_source_and_passages(self):
        payload = ingest_sample_text()
        assert payload["status"] == "completed"
        assert payload["sourceId"]
        assert payload["ingestionRunId"]
        assert payload["passageCount"] >= 1
        assert payload["warningCount"] >= 0

    def test_passages_persisted_and_queryable(self):
        payload = ingest_sample_text()
        passages = client.get(f"/v1/sources/{payload['sourceId']}/passages")
        assert passages.status_code == 200
        body = passages.json()
        assert len(body) >= 1
        assert body[0]["status"] == "candidate"
        assert "Photosynthesis" in body[0]["text"]

    def test_run_stored_in_postgres(self):
        payload = ingest_sample_text()
        run = client.get(f"/v1/ingest/runs/{payload['ingestionRunId']}")
        assert run.status_code == 200
        assert run.json()["status"] == "completed"

    def test_upsert_updates_existing_source(self):
        ingest_sample_text()
        response = client.post(
            "/v1/ingest/source",
            json={
                "tenantId": "tenant-1",
            "projectId": PROJECT_ID,
            "externalSourceId": SOURCE_EXT_ID,
            "title": "Updated Title",
                "sourceType": "markdown",
                "text": "Updated content after re-ingest.",
            },
        )
        assert response.status_code == 200
        body = response.json()
        sources = client.get(f"/v1/projects/{PROJECT_ID}/sources", params={"tenantId": "tenant-1"}).json()
        assert len(sources) == 1
        assert sources[0]["title"] == "Updated Title"

    def test_ingest_pdf_with_page_locations(self):
        import fitz

        doc = fitz.open()
        page1 = doc.new_page()
        page1.insert_text((72, 72), "First page about quantum mechanics.")
        page2 = doc.new_page()
        page2.insert_text((72, 72), "Second page about relativity.")
        pdf_bytes = doc.tobytes()
        doc.close()

        response = client.post(
            "/v1/ingest/pdf",
            data={
                "tenantId": "tenant-1",
                "projectId": PROJECT_ID,
                "externalSourceId": "00000000-0000-0000-0000-000000000003",
                "title": "Physics PDF",
            },
            files={"file": ("physics.pdf", pdf_bytes, "application/pdf")},
        )
        assert response.status_code == 200
        source_id = response.json()["sourceId"]
        passages = client.get(f"/v1/sources/{source_id}/passages").json()
        assert len(passages) >= 2
        pages = {p["location"]["page"] for p in passages}
        assert 1 in pages
        assert 2 in pages


class TestRetrieve:
    def test_returns_ranked_contexts(self):
        ingest_sample_text()
        response = client.post(
            "/v1/retrieve",
            json={
                "tenantId": "tenant-1",
                "projectId": PROJECT_ID,
                "query": "What captures light in photosynthesis?",
                "mode": "hybrid",
                "topK": 3,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["retrievalRunId"]
        assert body["retrievalMode"] == "hybrid"
        assert len(body["contexts"]) >= 1
        assert body["contexts"][0]["final_rank"] == 1

    def test_retrieval_run_persisted(self):
        ingest_sample_text()
        resp = client.post(
            "/v1/retrieve",
            json={
                "tenantId": "tenant-1",
                "projectId": PROJECT_ID,
                "query": "photosynthesis",
                "mode": "hybrid",
            },
        )
        run_id = resp.json()["retrievalRunId"]
        assert run_id  # retrieval run was created

    def test_respects_certified_filter(self):
        payload = ingest_sample_text()
        no_certified = client.post(
            "/v1/retrieve",
            json={
                "tenantId": "tenant-1",
                "projectId": PROJECT_ID,
                "query": "photosynthesis",
                "filters": {"passageStatus": ["certified"]},
            },
        )
        assert no_certified.status_code == 200
        assert no_certified.json()["contexts"] == []

        passage_id = client.get(f"/v1/sources/{payload['sourceId']}/passages").json()[0]["id"]
        client.post(f"/v1/curation/bulk?project_id={PROJECT_ID}", json={"actions": [{"type": "certify_passage", "passageId": passage_id}]})

        certified = client.post(
            "/v1/retrieve",
            json={
                "tenantId": "tenant-1",
                "projectId": PROJECT_ID,
                "query": "photosynthesis",
                "filters": {"passageStatus": ["certified"]},
            },
        )
        assert len(certified.json()["contexts"]) >= 1


class TestCuration:
    def test_certify_passage(self):
        payload = ingest_sample_text()
        passages = client.get(f"/v1/sources/{payload['sourceId']}/passages").json()
        passage_id = passages[0]["id"]

        curation = client.post(
            f"/v1/curation/bulk?project_id={PROJECT_ID}",
            json={"actions": [{"type": "certify_passage", "passageId": passage_id}]},
        )
        assert curation.status_code == 200
        assert curation.json()["results"][0]["ok"]

        updated = client.get(f"/v1/passages/{passage_id}").json()
        assert updated["status"] == "certified"

    def test_add_and_clear_quality_warning(self):
        payload = ingest_sample_text()
        passages = client.get(f"/v1/sources/{payload['sourceId']}/passages").json()
        passage_id = passages[0]["id"]

        client.post(
            f"/v1/curation/bulk?project_id={PROJECT_ID}",
            json={"actions": [
                {"type": "add_quality_warning", "passageId": passage_id, "warning": "needs_review"},
            ]},
        )
        updated = client.get(f"/v1/passages/{passage_id}").json()
        assert "needs_review" in updated["quality_warnings"]

        client.post(
            f"/v1/curation/bulk?project_id={PROJECT_ID}",
            json={"actions": [
                {"type": "clear_quality_warning", "passageId": passage_id, "warning": "needs_review"},
            ]},
        )
        cleared = client.get(f"/v1/passages/{passage_id}").json()
        assert "needs_review" not in cleared["quality_warnings"]

    def test_toggle_retrieval_enabled(self):
        payload = ingest_sample_text()
        passages = client.get(f"/v1/sources/{payload['sourceId']}/passages").json()
        passage_id = passages[0]["id"]

        client.post(
            f"/v1/curation/bulk?project_id={PROJECT_ID}",
            json={"actions": [
                {"type": "set_passage_retrieval_enabled", "passageId": passage_id, "enabled": False},
            ]},
        )
        disabled = client.get(f"/v1/passages/{passage_id}").json()
        assert disabled["retrieval_enabled"] is False

        client.post(
            f"/v1/curation/bulk?project_id={PROJECT_ID}",
            json={"actions": [
                {"type": "set_passage_retrieval_enabled", "passageId": passage_id, "enabled": True},
            ]},
        )
        enabled = client.get(f"/v1/passages/{passage_id}").json()
        assert enabled["retrieval_enabled"] is True

    def test_reject_passage(self):
        payload = ingest_sample_text()
        passages = client.get(f"/v1/sources/{payload['sourceId']}/passages").json()
        passage_id = passages[0]["id"]

        client.post(
            f"/v1/curation/bulk?project_id={PROJECT_ID}",
            json={"actions": [{"type": "reject_passage", "passageId": passage_id}]},
        )
        rejected = client.get(f"/v1/passages/{passage_id}").json()
        assert rejected["status"] == "rejected"

    def test_curation_persists_across_requests(self):
        """Certify then retrieve - state must persist in Postgres."""
        payload = ingest_sample_text()
        passage_id = client.get(f"/v1/sources/{payload['sourceId']}/passages").json()[0]["id"]

        client.post(f"/v1/curation/bulk?project_id={PROJECT_ID}", json={"actions": [{"type": "certify_passage", "passageId": passage_id}]})

        resp = client.post(
            "/v1/retrieve",
            json={
                "tenantId": "tenant-1",
                "projectId": PROJECT_ID,
                "query": "photosynthesis",
                "filters": {"passageStatus": ["certified"]},
            },
        )
        assert len(resp.json()["contexts"]) >= 1
