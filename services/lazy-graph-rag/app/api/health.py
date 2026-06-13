from fastapi import APIRouter
from app.settings import get_settings

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.get("/metadata")
def metadata():
    settings = get_settings()
    return {
        "service": "lazy-graph-rag",
        "gliner_model": settings.GLINER_MODEL,
        "embedding_model": settings.EMBEDDING_MODEL,
        "embedding_dimensions": settings.EMBEDDING_DIMENSIONS
    }
