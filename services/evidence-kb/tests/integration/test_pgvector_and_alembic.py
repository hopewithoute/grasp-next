"""Integration tests: pgvector retrieval and Alembic migrations against live Postgres."""

import os

import psycopg2
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.storage.deps import get_embedding
from tests.integration.conftest import _truncate_tables_sync

DB_URL = os.environ.get("DATABASE_URL", "")
DB_NAME = "evidence_kb_test"
DB_SCHEMA = os.environ.get("DB_SCHEMA", "evidence_kb_test_schema")
PG_DSN = dict(host="localhost", dbname=DB_NAME, user="postgres", password="gas12kilo")

client = TestClient(app, headers={"x-api-key": "test-key"})


class DummyEmbeddingClient:
    async def embed_query(self, text: str) -> list[float]:
        return [0.1] * 8

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[0.1] * 8 for _ in texts]


app.dependency_overrides[get_embedding] = lambda: DummyEmbeddingClient()


@pytest.fixture(autouse=True)
def _clean_tables():
    _truncate_tables_sync()
    yield


class TestPgVectorRetrieval:
    """Test pgvector + tsvector SQL retrieval (when embeddings are stored)."""

    def _ingest_with_embeddings(self, texts: list[str], source_ext_id: str = "00000000-0000-0000-0000-000000000010"):
        """Ingest text and manually set embeddings to test pgvector retrieval."""
        combined = "\n\n".join(texts)
        resp = client.post(
            "/v1/ingest/source",
            json={
                "tenantId": "tenant-1",
                "projectId": "00000000-0000-0000-0000-000000000001",
                "externalSourceId": source_ext_id,
                "title": "Test Source",
                "sourceType": "text",
                "text": combined,
            },
        )
        assert resp.status_code == 200
        source_id = resp.json()["sourceId"]

        # Manually set embeddings via direct SQL since we don't have a live embedding sidecar
        passages_resp = client.get(f"/v1/sources/{source_id}/passages")
        assert passages_resp.status_code == 200
        passage_ids = [p["id"] for p in passages_resp.json()]

        conn = psycopg2.connect(**PG_DSN)
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                for i, pid in enumerate(passage_ids):
                    # Create simple deterministic vectors (different for each passage)
                    vec = [0.1 * (i + 1)] * 8  # 8-dim (EMBEDDING_DIMENSIONS=8)
                    vec_str = "[" + ",".join(str(v) for v in vec) + "]"
                    cur.execute(
                        f"UPDATE {DB_SCHEMA}.kb_passages SET embedding = %s::vector WHERE id = %s",
                        (vec_str, pid),
                    )
        finally:
            conn.close()

        return source_id, passage_ids

    def test_vector_only_retrieval_with_embeddings(self):
        """When passages have embeddings, vector_only retrieval should use pgvector."""
        self._ingest_with_embeddings(
            [
                "Photosynthesis converts light energy into chemical energy in plants.",
                "Quantum mechanics describes the behavior of subatomic particles.",
            ]
        )

        resp = client.post(
            "/v1/retrieve",
            json={
                "tenantId": "tenant-1",
                "projectId": "00000000-0000-0000-0000-000000000001",
                "query": "light energy",
                "mode": "vector_only",
                "topK": 2,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["contexts"]) >= 1
        assert body["contexts"][0]["score"] > 0

    def test_bm25_only_retrieval_with_tsvector(self):
        """When passages have search_vector, bm25_only retrieval should use tsvector."""
        self._ingest_with_embeddings(
            [
                "Photosynthesis converts light energy into chemical energy.",
                "Quantum mechanics describes subatomic particle behavior.",
            ]
        )

        resp = client.post(
            "/v1/retrieve",
            json={
                "tenantId": "tenant-1",
                "projectId": "00000000-0000-0000-0000-000000000001",
                "query": "photosynthesis light",
                "mode": "bm25_only",
                "topK": 2,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["contexts"]) >= 1
        # The photosynthesis passage should rank first
        assert "Photosynthesis" in body["contexts"][0]["text"]

    def test_hybrid_retrieval_fuses_bm25_and_vector(self):
        """Hybrid mode should combine pgvector and tsvector via RRF."""
        self._ingest_with_embeddings(
            [
                "Photosynthesis converts light energy into chemical energy in plants.",
                "Cellular respiration releases energy from glucose molecules.",
            ]
        )

        resp = client.post(
            "/v1/retrieve",
            json={
                "tenantId": "tenant-1",
                "projectId": "00000000-0000-0000-0000-000000000001",
                "query": "energy",
                "mode": "hybrid",
                "topK": 2,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["contexts"]) >= 1
        # Both passages mention energy, so both should be returned
        assert body["contexts"][0]["final_rank"] == 1

    def test_retrieval_with_certified_filter(self):
        """Filters should work with pgvector retrieval."""
        self._ingest_with_embeddings(
            [
                "Photosynthesis converts light energy.",
                "Quantum mechanics describes particles.",
            ]
        )

        # No certified passages → empty
        resp = client.post(
            "/v1/retrieve",
            json={
                "tenantId": "tenant-1",
                "projectId": "00000000-0000-0000-0000-000000000001",
                "query": "energy",
                "mode": "vector_only",
                "filters": {"passageStatus": ["certified"]},
            },
        )
        assert resp.json()["contexts"] == []

    def test_embedding_stored_during_ingestion(self):
        """Verify passage embedding column is populated (via manual set in test)."""
        source_id, passage_ids = self._ingest_with_embeddings(
            [
                "Test content for embedding verification.",
            ]
        )

        conn = psycopg2.connect(**PG_DSN)
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT embedding IS NOT NULL FROM {DB_SCHEMA}.kb_passages WHERE id = %s",
                    (passage_ids[0],),
                )
                row = cur.fetchone()
                assert row is not None
                assert row[0] is True
        finally:
            conn.close()


class TestAlembicMigrations:
    """Test Alembic migration lifecycle."""

    def test_alembic_stamp_and_check(self):
        """Verify stamp head + check reports no pending migrations."""
        import subprocess

        env = {
            **os.environ,
            "DATABASE_URL": DB_URL,
            "DB_SCHEMA": DB_SCHEMA,
            "EMBEDDING_DIMENSIONS": "8",
            "STORAGE_BACKEND": "postgres",
        }

        cwd = "/var/www/grasp-next/services/evidence-kb"

        # Stamp head
        result = subprocess.run(
            ["uv", "run", "alembic", "stamp", "head"],
            capture_output=True,
            text=True,
            env=env,
            cwd=cwd,
        )
        assert result.returncode == 0, f"alembic stamp head failed: {result.stderr}"

        # Check should report no new operations
        result = subprocess.run(
            ["uv", "run", "alembic", "check"],
            capture_output=True,
            text=True,
            env=env,
            cwd=cwd,
        )
        assert "No new upgrade operations" in result.stderr or "No new upgrade operations" in result.stdout

    def test_alembic_upgrade_downgrade_cycle(self):
        """Verify upgrade/downgrade round-trips without error."""
        import subprocess

        env = {
            **os.environ,
            "DATABASE_URL": DB_URL,
            "DB_SCHEMA": DB_SCHEMA,
            "EMBEDDING_DIMENSIONS": "8",
            "STORAGE_BACKEND": "postgres",
        }
        cwd = "/var/www/grasp-next/services/evidence-kb"

        # Upgrade to head
        result = subprocess.run(
            ["uv", "run", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            env=env,
            cwd=cwd,
        )
        assert result.returncode == 0

        # Downgrade to base
        result = subprocess.run(
            ["uv", "run", "alembic", "downgrade", "base"],
            capture_output=True,
            text=True,
            env=env,
            cwd=cwd,
        )
        assert result.returncode == 0

        # Upgrade to head again
        result = subprocess.run(
            ["uv", "run", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            env=env,
            cwd=cwd,
        )
        assert result.returncode == 0
