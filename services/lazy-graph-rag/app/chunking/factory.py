from app.chunking.contracts import ChunkerContract
from app.chunking.recursive import RecursiveChunker
from app.settings import Settings, get_settings

def create_chunker(settings: Settings | None = None) -> ChunkerContract:
    resolved = settings or get_settings()
    # Support other chunkers based on settings if needed
    return RecursiveChunker()
