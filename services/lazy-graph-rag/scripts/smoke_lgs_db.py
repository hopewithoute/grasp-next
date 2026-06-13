import asyncio
import sys
from pathlib import Path
from typing import Iterable

SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from sqlalchemy import func, select

from app.extraction.contracts import ExtractionCandidate
from app.indexing import source_indexer
from app.indexing.source_indexer import SourceIndexer
from app.retrieval import hybrid
from app.retrieval.hybrid import HybridSearcher
from app.storage import db
from app.storage.graph_repository import GraphRepository
from app.storage.models import Document, Term
from app.storage.repositories import SourceRepository


TENANT_ID = "smoke-owner-lgs-cutover"
COLLECTION_ID = "smoke-project-lgs-cutover"
SOURCE_ID = "smoke-source-lgs-cutover"
CONTENT = """# PostgreSQL and pgvector

PostgreSQL supports pgvector for vector search. pgvector works with hybrid retrieval and lexical search.
"""


class FakeExtractor:
    def extract_terms(
        self,
        chunks: Iterable[object],
        labels: list[str],
        threshold: float,
    ) -> list[ExtractionCandidate]:
        first_chunk = next(iter(chunks), None)
        if first_chunk is None:
            return []

        content = first_chunk.content
        candidates: list[ExtractionCandidate] = []
        for text, label in [
            ("PostgreSQL", "technology"),
            ("pgvector", "tool"),
            ("hybrid retrieval", "method"),
        ]:
            start = content.lower().find(text.lower())
            if start >= 0:
                candidates.append(
                    ExtractionCandidate(
                        chunkId="0",
                        text=text,
                        label=label,
                        startOffset=start,
                        endOffset=start + len(text),
                        confidence=0.99,
                    )
                )

        return candidates


class FakeEmbedding:
    def create_embeddings(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            seed = (sum(ord(char) for char in text) % 17) / 1000
            vectors.append([0.001 + seed] * 1024)
        return vectors


async def count_leftovers() -> tuple[int, int]:
    async with db.AsyncSessionLocal() as session:
        document_count = await session.scalar(
            select(func.count()).select_from(Document).where(Document.collection_id == COLLECTION_ID)
        )
        term_count = await session.scalar(
            select(func.count()).select_from(Term).where(Term.collection_id == COLLECTION_ID)
        )

    return int(document_count or 0), int(term_count or 0)


async def main() -> None:
    source_indexer.create_term_extractor = lambda settings: FakeExtractor()
    source_indexer.create_embedding_runtime = lambda settings: FakeEmbedding()
    hybrid.create_embedding_runtime = lambda settings: FakeEmbedding()

    db.init_db()

    async with db.AsyncSessionLocal() as session:
        repo = SourceRepository(session)
        await repo.delete_collection(TENANT_ID, COLLECTION_ID)
        await session.commit()

    async with db.AsyncSessionLocal() as session:
        indexed = await SourceIndexer(session).index_source(
            tenant_id=TENANT_ID,
            collection_id=COLLECTION_ID,
            source_id=SOURCE_ID,
            source_type="markdown",
            document_name="Smoke Source",
            content=CONTENT,
            content_uri=None,
            content_metadata={"smoke": True},
        )
        print("INDEX", indexed)
        assert indexed["status"] == "indexed"
        assert indexed["chunkCount"] >= 1
        assert indexed["termCount"] == 3
        assert indexed["chunkTermCount"] == 3

    async with db.AsyncSessionLocal() as session:
        search = await HybridSearcher(session).search(
            tenant_id=TENANT_ID,
            collection_id=COLLECTION_ID,
            query="pgvector search",
            top_k=5,
        )
        print("SEARCH", {"count": len(search["results"]), "trace": search["trace"]})
        assert search["results"], "search returned no chunks"
        assert search["results"][0]["source_id"] == SOURCE_ID

    async with db.AsyncSessionLocal() as session:
        graph = await GraphRepository(session).get_local_graph(
            tenant_id=TENANT_ID,
            collection_id=COLLECTION_ID,
            limit=20,
        )
        print(
            "GRAPH",
            {
                "nodes": len(graph["nodes"]),
                "edges": len(graph["edges"]),
                "labels": [node["data"]["label"] for node in graph["nodes"]],
            },
        )
        assert len(graph["nodes"]) >= 2, "graph returned too few terms"
        assert graph["edges"], "graph returned no co-occurrence edges"

    async with db.AsyncSessionLocal() as session:
        repo = SourceRepository(session)
        deleted_source = await repo.delete_document_by_source(TENANT_ID, COLLECTION_ID, SOURCE_ID)
        await repo.cleanup_orphan_terms(TENANT_ID, COLLECTION_ID)
        await session.commit()
        print("DELETE_SOURCE", {"deletedDocumentCount": deleted_source})
        assert deleted_source == 1

    async with db.AsyncSessionLocal() as session:
        repo = SourceRepository(session)
        deleted_collection = await repo.delete_collection(TENANT_ID, COLLECTION_ID)
        await session.commit()
        print("DELETE_COLLECTION", {"deletedDocumentCount": deleted_collection})
        assert deleted_collection == 0

    document_count, term_count = await count_leftovers()
    print("LEFTOVERS", {"documents": document_count, "terms": term_count})
    assert document_count == 0
    assert term_count == 0


if __name__ == "__main__":
    asyncio.run(main())
