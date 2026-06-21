from uuid import UUID
from typing import Any, Literal
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from app.api.auth import verify_api_key
from app.chunking.recursive import chunk_text
from app.models import IngestionRunRecord, Location, SourceRecord
from app.parsing.parser import parse_pdf_bytes, parse_text
from app.quality.chunk_checks import score_chunk
from app.settings import get_settings
from app.embedding.client import EmbeddingClient
from app.storage.deps import get_repository, get_embedding
from app.storage.sql_repository import SqlEvidenceRepository

router = APIRouter(prefix="/v1/ingest", tags=["ingest"])


class IngestSourceRequest(BaseModel):
    tenantId: str
    projectId: UUID
    externalSourceId: UUID
    title: str
    sourceType: Literal["text", "markdown", "html", "pdf", "web"]
    text: str | None = None
    fileUrl: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestSourceResponse(BaseModel):
    ingestionRunId: UUID
    sourceId: UUID
    status: str
    passageCount: int
    warningCount: int


@router.post("/source", response_model=IngestSourceResponse)
async def ingest_source(
    request: IngestSourceRequest,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
    embedding_client: EmbeddingClient | None = Depends(get_embedding),
):
    if request.sourceType == "pdf":
        raise HTTPException(status_code=422, detail="Use /v1/ingest/pdf for PDF uploads")
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=422, detail="text is required for this source type")

    source = await repository.upsert_source(
        tenant_id=request.tenantId,
        project_id=request.projectId,
        external_source_id=request.externalSourceId,
        title=request.title,
        source_type=request.sourceType,
        metadata=request.metadata,
    )
    return await _ingest_blocks(
        parsed_blocks=parse_text(request.text),
        repository=repository,
        source=source,
        source_type=request.sourceType,
        embedding_client=embedding_client,
    )


@router.post("/pdf", response_model=IngestSourceResponse)
async def ingest_pdf(
    tenantId: str = Form(...),
    projectId: UUID = Form(...),
    externalSourceId: UUID = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
    embedding_client: EmbeddingClient | None = Depends(get_embedding),
):
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=422, detail="file must be a PDF")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="file is empty")

    source = await repository.upsert_source(
        tenant_id=tenantId,
        project_id=projectId,
        external_source_id=externalSourceId,
        title=title,
        source_type="pdf",
        metadata={"filename": file.filename},
    )

    import asyncio

    parsed_blocks = await asyncio.to_thread(parse_pdf_bytes, content)

    return await _ingest_blocks(
        parsed_blocks=parsed_blocks,
        repository=repository,
        source=source,
        source_type="pdf",
        embedding_client=embedding_client,
    )


async def _ingest_blocks(
    parsed_blocks: list[tuple[str, Location]],
    repository: SqlEvidenceRepository,
    source: SourceRecord,
    source_type: str,
    embedding_client: EmbeddingClient | None = None,
) -> IngestSourceResponse:
    settings = get_settings()
    run = await repository.create_run(source.tenant_id, source.project_id, source.id)

    try:

        def process_blocks():
            _passage_chunks = []
            _chunk_texts = []
            _order = 0
            for block_index, (block_text, base_location) in enumerate(parsed_blocks):
                chunks = chunk_text(block_text, settings.CHUNK_SIZE_CHARS, settings.CHUNK_OVERLAP_CHARS)
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

        import asyncio

        passage_chunks, chunk_texts = await asyncio.to_thread(process_blocks)

        embeddings: list[list[float]] | None = None
        if embedding_client and chunk_texts:
            try:
                embeddings = await embedding_client.embed_texts(chunk_texts)
            except Exception:
                pass

        await repository.replace_source_passages(source, passage_chunks, embeddings=embeddings)
        warning_count = sum(len(chunk[6]) for chunk in passage_chunks)
        run = await repository.complete_run(
            run.id,
            {"passageCount": len(passage_chunks), "sourceType": source_type, "warningCount": warning_count},
        )
    except Exception as error:
        await repository.fail_run(run.id, str(error))
        raise

    return IngestSourceResponse(
        ingestionRunId=run.id,
        passageCount=run.stats.get("passageCount", 0),
        sourceId=source.id,
        status=run.status,
        warningCount=run.stats.get("warningCount", 0),
    )


@router.get("/runs/{run_id}", response_model=IngestionRunRecord)
async def get_ingestion_run(
    run_id: str,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
):
    run = await repository.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Ingestion run not found")
    return run
