from app.extraction.contracts import ExtractorContract
from app.extraction.gliner_extractor import GLiNERExtractor
from app.extraction.http_adapter import HTTPExtractorAdapter
from app.settings import Settings, get_settings


def create_term_extractor(settings: Settings | None = None) -> ExtractorContract:
    resolved = settings or get_settings()
    if resolved.TERM_EXTRACTOR_BASE_URL:
        return HTTPExtractorAdapter(
            url=resolved.TERM_EXTRACTOR_BASE_URL,
            token=resolved.TERM_EXTRACTOR_API_KEY,
        )

    return GLiNERExtractor(model_name=resolved.GLINER_MODEL)
