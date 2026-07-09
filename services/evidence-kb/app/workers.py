import asyncio
import base64
import logging
from oban import worker
from oban.oban import Oban

from app.storage.db import get_sessionmaker
from app.storage.sql_repository import SqlEvidenceRepository
from app.parsing.parser import parse_pdf_bytes, parse_text
from app.actions.ingest_action import _ingest_blocks
from app.storage.s3_client import s3_client
from app.embedding.client import get_embedding_client
from app.settings import get_settings
from app.actions.clustering_action import cluster_project_topics
from app.settings import get_settings

logger = logging.getLogger(__name__)

@worker(queue="ingestion", max_attempts=3)
class EvidenceIngestionWorker:
    async def process(self, job):
        run_id = job.args["run_id"]
        source_id = job.args["source_id"]
        source_type = job.args["source_type"]
        project_id = job.args["project_id"]

        sessionmaker = get_sessionmaker()
        
        async with sessionmaker() as session:
            repository = SqlEvidenceRepository(session)
            source = await repository.get_source(source_id)
            
            if not source:
                logger.error(f"Source {source_id} not found for ingestion run {run_id}")
                return
            
            # 1. Start processing - emit SSE update
            try:
                await Oban.get_instance()._notifier.notify(
                    "ingestion_updates",
                    {
                        "project_id": str(project_id),
                        "source_id": str(source_id),
                        "run_id": str(run_id),
                        "status": "processing"
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to notify processing status: {e}")

            try:
                settings = get_settings()
                embedding_client = get_embedding_client(
                    base_url=settings.EMBEDDING_SERVICE_URL,
                    api_key=settings.EMBEDDING_SERVICE_API_KEY,
                    dimensions=settings.EMBEDDING_DIMENSIONS,
                )
                
                if source_type == "pdf":
                    content = None
                    if "s3_key" in source.metadata and s3_client.is_configured:
                        content = await s3_client.download_file_bytes(source.metadata["s3_key"])
                    elif "content_b64" in source.metadata:
                        content = base64.b64decode(source.metadata["content_b64"])
                        
                    if not content:
                        raise ValueError("PDF content could not be retrieved from S3 or metadata")
                        
                    parsed_blocks = await asyncio.to_thread(parse_pdf_bytes, content)
                else:
                    # Text source
                    text_content = source.metadata.get("content", "")
                    if not text_content:
                        raise ValueError("Text content is missing in metadata")
                    parsed_blocks = parse_text(text_content)
                
                await _ingest_blocks(
                    run_id=run_id,
                    parsed_blocks=parsed_blocks,
                    repository=repository,
                    source=source,
                    source_type=source_type,
                    embedding_client=embedding_client,
                )
                
                # 2.5 Run clustering for the whole project to update the concept graph
                try:
                    await cluster_project_topics(source.tenant_id, str(project_id))
                except Exception as ce:
                    logger.error(f"Failed to cluster project topics after ingestion: {ce}")

                
                # Check if it failed internally inside _ingest_blocks
                run = await repository.get_run(run_id)
                final_status = run.status if run else "completed"
                
            except Exception as error:
                logger.exception("Ingestion failed")
                await repository.fail_run(run_id, str(error))
                final_status = "failed"

            # 3. Emit SSE update for completion
            try:
                await Oban.get_instance()._notifier.notify(
                    "ingestion_updates",
                    {
                        "project_id": str(project_id),
                        "source_id": str(source_id),
                        "run_id": str(run_id),
                        "status": final_status
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to notify completion status: {e}")
