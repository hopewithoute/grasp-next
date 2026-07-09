import asyncio
import logging
from typing import TYPE_CHECKING
from uuid import UUID
from fastapi import Depends, HTTPException, UploadFile
from app.chunking.chonkie_adapter import chunk_texts_semantic_batch
from app.models import IngestionRunRecord, Location, SourceRecord
import base64
from app.quality.chunk_checks import score_chunk
from app.embedding.client import EmbeddingClient
from app.storage.deps import get_repository, get_embedding
from app.storage.sql_repository import SqlEvidenceRepository

if TYPE_CHECKING:
    from app.contracts import IngestSourceRequest
    from app.storage.sql_repository import SqlEvidenceRepository
from app.storage.s3_client import s3_client

logger = logging.getLogger(__name__)


async def _ingest_blocks(
    run_id: str,
    parsed_blocks: list[tuple[str, Location]],
    repository: SqlEvidenceRepository,
    source: SourceRecord,
    source_type: str,
    embedding_client: EmbeddingClient | None = None,
) -> None:
    try:

        def process_blocks():
            _passage_chunks = []
            _chunk_texts = []
            _order = 0

            # Use batch chunking for significant performance gains
            block_texts = [block_text for block_text, _ in parsed_blocks]
            batch_chunks = chunk_texts_semantic_batch(block_texts)

            for block_index, ((block_text, base_location), chunks) in enumerate(zip(parsed_blocks, batch_chunks)):
                for chunk in chunks:
                    quality_score, warnings = score_chunk(chunk.text)
                    location = Location(
                        page=base_location.page,
                        heading=base_location.heading,
                        start_offset=chunk.start_offset,
                        end_offset=chunk.end_offset,
                    )
                    _passage_chunks.append(
                        (
                            f"block-{block_index}-{chunk.index}",
                            chunk.text,
                            location,
                            _order,
                            chunk.estimated_tokens,
                            quality_score,
                            warnings,
                        )
                    )
                    _chunk_texts.append(chunk.text)
                    _order += 1
            return _passage_chunks, _chunk_texts

        passage_chunks, chunk_texts = await asyncio.to_thread(process_blocks)

        embeddings: list[list[float]] | None = None
        if embedding_client and chunk_texts:
            try:
                embeddings = await embedding_client.embed_texts(chunk_texts)
            except Exception:
                pass

        passage_records = await repository.replace_source_passages(source, passage_chunks, embeddings=embeddings)

        def extract_topics():
            import re
            from collections import Counter

            topics = []
            for i, chunk_text in enumerate(chunk_texts):
                if i < len(passage_records):
                    passage_id = passage_records[i]["id"]
                    words = re.findall(r"\b[A-Z][a-z]{4,}\b", chunk_text)
                    if words:
                        top_words = [word for word, count in Counter(words).most_common(2)]
                        for w in top_words:
                            topics.append((passage_id, w.upper()))
            return topics

        passage_topics = await asyncio.to_thread(extract_topics)

        if passage_topics:
            await repository.replace_source_topics(source, passage_topics)
        warning_count = sum(len(chunk[6]) for chunk in passage_chunks)
        await repository.complete_run(
            run_id,
            {"passageCount": len(passage_chunks), "sourceType": source_type, "warningCount": warning_count},
        )
    except Exception as error:
        await repository.fail_run(run_id, str(error))





class IngestAction:
    def __init__(
        self,
        repository: SqlEvidenceRepository = Depends(get_repository),
        embedding_client: EmbeddingClient | None = Depends(get_embedding),
    ):
        self.repository = repository
        self.embedding_client = embedding_client

    async def ingest_source(
        self,
        request: "IngestSourceRequest",
    ) -> dict:

        if request.sourceType == "pdf":
            raise HTTPException(status_code=422, detail="Use /v1/ingest/pdf for PDF uploads")
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=422, detail="text is required for this source type")

        metadata_copy = request.metadata.copy()
        if request.text:
            metadata_copy["content"] = request.text

        source = await self.repository.upsert_source(
            tenant_id=request.tenantId,
            project_id=str(request.projectId),
            external_source_id=str(request.externalSourceId),
            title=request.title,
            source_type=request.sourceType,
            metadata=metadata_copy,
        )
        run = await self.repository.create_run(source.tenant_id, str(source.project_id), str(source.id))
        
        from app.workers import EvidenceIngestionWorker
        await EvidenceIngestionWorker.enqueue(
            {
                "run_id": str(run.id),
                "source_id": str(source.id),
                "source_type": request.sourceType,
                "tenant_id": request.tenantId,
                "project_id": str(request.projectId),
            }
        )
        return {
            "ingestionRunId": run.id,
            "passageCount": 0,
            "sourceId": source.id,
            "status": "processing",
            "warningCount": 0,
        }

    async def ingest_pdf(
        self,
        tenantId: str,
        projectId: UUID,
        externalSourceId: UUID,
        title: str,
        file: UploadFile,
    ) -> dict:
        if file.content_type not in {"application/pdf", "application/octet-stream"}:
            raise HTTPException(status_code=422, detail="file must be a PDF")

        content = await file.read()
        if not content:
            raise HTTPException(status_code=422, detail="file is empty")

        s3_key = f"{tenantId}/{projectId}/sources/{externalSourceId}_{file.filename}"
        try:
            if not s3_client.is_configured:
                raise ValueError("S3 is not configured")
            await s3_client.upload_file_bytes(content, s3_key, file.content_type)
            metadata = {"filename": file.filename, "s3_key": s3_key}
        except Exception as e:
            logger.warning(f"S3 upload failed, continuing without S3 (falling back to base64 metadata): {e}")
            metadata = {"filename": file.filename, "content_b64": base64.b64encode(content).decode("utf-8")}

        source = await self.repository.upsert_source(
            tenant_id=tenantId,
            project_id=str(projectId),
            external_source_id=str(externalSourceId),
            title=title,
            source_type="pdf",
            metadata=metadata,
        )

        run = await self.repository.create_run(source.tenant_id, str(source.project_id), str(source.id))
        
        from app.workers import EvidenceIngestionWorker
        await EvidenceIngestionWorker.enqueue(
            {
                "run_id": str(run.id),
                "source_id": str(source.id),
                "source_type": "pdf",
                "tenant_id": tenantId,
                "project_id": str(projectId),
            }
        )
        return {
            "ingestionRunId": run.id,
            "passageCount": 0,
            "sourceId": source.id,
            "status": "processing",
            "warningCount": 0,
        }

    async def get_ingestion_run(self, run_id: str) -> IngestionRunRecord:
        run = await self.repository.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Ingestion run not found")
        return run

    async def list_runs_for_project(self, project_id: str, limit: int = 100) -> list[IngestionRunRecord]:
        return await self.repository.list_runs_for_project(project_id, limit)
