from uuid import UUID
from typing import Annotated, Any, Literal
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, BackgroundTasks
from pydantic import BaseModel, Field
from app.chunking.chonkie_adapter import chunk_texts_semantic_batch
from app.api.auth import verify_api_key
from app.settings import get_settings
from app.models import IngestionRunRecord, Location, SourceRecord
from app.parsing.parser import parse_pdf_bytes, parse_text
from app.quality.chunk_checks import score_chunk
from app.embedding.client import EmbeddingClient, get_embedding_client
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
    background_tasks: BackgroundTasks,
    _: None = Depends(verify_api_key),
    repository: SqlEvidenceRepository = Depends(get_repository),
    embedding_client: EmbeddingClient | None = Depends(get_embedding),
):
    if request.sourceType == "pdf":
        raise HTTPException(status_code=422, detail="Use /v1/ingest/pdf for PDF uploads")
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=422, detail="text is required for this source type")

    metadata = request.metadata.copy()
    if request.text:
        metadata["content"] = request.text

    source = await repository.upsert_source(
        tenant_id=request.tenantId,
        project_id=request.projectId,
        external_source_id=request.externalSourceId,
        title=request.title,
        source_type=request.sourceType,
        metadata=metadata,
    )
    run = await repository.create_run(source.tenant_id, source.project_id, source.id)
    background_tasks.add_task(
        _ingest_blocks,
        run_id=run.id,
        parsed_blocks=parse_text(request.text),
        repository=repository,
        source=source,
        source_type=request.sourceType,
        embedding_client=embedding_client,
    )
    return IngestSourceResponse(
        ingestionRunId=run.id,
        passageCount=0,
        sourceId=source.id,
        status="processing",
        warningCount=0,
    )


async def _process_pdf_background(
    run_id: str,
    content: bytes,
    repository: SqlEvidenceRepository,
    source: SourceRecord,
    embedding_client: EmbeddingClient | None = None,
):
    import asyncio
    from app.parsing.parser import parse_pdf_bytes
    try:
        parsed_blocks = await asyncio.to_thread(parse_pdf_bytes, content)
        await _ingest_blocks(
            run_id=run_id,
            parsed_blocks=parsed_blocks,
            repository=repository,
            source=source,
            source_type="pdf",
            embedding_client=embedding_client,
        )
    except Exception as error:
        await repository.fail_run(run_id, str(error))

@router.post("/pdf", response_model=IngestSourceResponse)
async def ingest_pdf(
    background_tasks: BackgroundTasks,
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

    from app.storage.s3_client import s3_client
    s3_key = f"{tenantId}/{projectId}/sources/{externalSourceId}_{file.filename}"
    try:
        await s3_client.upload_file_bytes(content, s3_key, file.content_type)
        metadata = {"filename": file.filename, "s3_key": s3_key}
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"S3 upload failed, continuing without S3: {e}")
        metadata = {"filename": file.filename}

    source = await repository.upsert_source(
        tenant_id=tenantId,
        project_id=projectId,
        external_source_id=externalSourceId,
        title=title,
        source_type="pdf",
        metadata=metadata,
    )

    run = await repository.create_run(source.tenant_id, source.project_id, source.id)
    background_tasks.add_task(
        _process_pdf_background,
        run_id=run.id,
        content=content,
        repository=repository,
        source=source,
        embedding_client=embedding_client,
    )
    return IngestSourceResponse(
        ingestionRunId=run.id,
        passageCount=0,
        sourceId=source.id,
        status="processing",
        warningCount=0,
    )


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

        import asyncio

        passage_chunks, chunk_texts = await asyncio.to_thread(process_blocks)

        embeddings: list[list[float]] | None = None
        if embedding_client and chunk_texts:
            try:
                embeddings = await embedding_client.embed_texts(chunk_texts)
            except Exception:
                import traceback
                with open("/tmp/embed_error.log", "w") as f:
                    f.write(traceback.format_exc())
                pass

        await repository.replace_source_passages(source, passage_chunks, embeddings=embeddings)
        warning_count = sum(len(chunk[6]) for chunk in passage_chunks)
        await repository.complete_run(
            run_id,
            {"passageCount": len(passage_chunks), "sourceType": source_type, "warningCount": warning_count},
        )
    except Exception as error:
        await repository.fail_run(run_id, str(error))


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
