from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.embedding.client import EmbeddingClient, get_embedding_client
from app.settings import get_settings
from app.storage.db import get_db_session
from app.storage.sql_repository import SqlEvidenceRepository


async def get_embedding() -> EmbeddingClient | None:
    settings = get_settings()
    return get_embedding_client(
        base_url=settings.EMBEDDING_SERVICE_URL,
        api_key=settings.EMBEDDING_SERVICE_API_KEY,
        dimensions=settings.EMBEDDING_DIMENSIONS,
    )


async def get_repository(
    session: AsyncSession = Depends(get_db_session),
) -> SqlEvidenceRepository:
    return SqlEvidenceRepository(session)
