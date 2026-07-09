from sqlalchemy import text
from app.settings import get_settings
from app.storage.db import get_sessionmaker


class HealthAction:
    async def check_health(self) -> dict:
        settings = get_settings()
        result = {"status": "ok", "service": "evidence-kb", "storage_backend": settings.STORAGE_BACKEND}

        if settings.STORAGE_BACKEND == "postgres":
            try:
                sessionmaker = get_sessionmaker()
                async with sessionmaker() as session:
                    await session.execute(text("SELECT 1"))
                result["database"] = "connected"
            except Exception as exc:
                result["status"] = "degraded"
                result["database"] = f"error: {exc}"

        return result

    def get_metadata(self) -> dict:
        settings = get_settings()
        return {
            "service": "evidence-kb",
            "chunk_size_chars": settings.CHUNK_SIZE_CHARS,
            "chunk_overlap_chars": settings.CHUNK_OVERLAP_CHARS,
            "rrf_k": settings.RRF_K,
            "storage_backend": settings.STORAGE_BACKEND,
            "embedding_dimensions": settings.EMBEDDING_DIMENSIONS,
        }
