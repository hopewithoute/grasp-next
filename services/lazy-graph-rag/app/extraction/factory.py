from app.extraction.contracts import ExtractorContract
from app.extraction.gliner_extractor import GLiNERExtractor
from app.extraction.http_adapter import HTTPExtractorAdapter
from app.extraction.pipeline import TermExtractionPipeline
from app.settings import Settings, get_settings


def create_term_extractor(settings: Settings | None = None) -> ExtractorContract:
    resolved = settings or get_settings()
    extractors = []
    
    if resolved.TERM_EXTRACTOR_BASE_URL:
        extractors.append(HTTPExtractorAdapter(
            url=resolved.TERM_EXTRACTOR_BASE_URL,
            token=resolved.TERM_EXTRACTOR_API_KEY,
        ))
    else:
        mode = getattr(resolved, "TERM_EXTRACTOR_MODE", "gliner").lower()
        if mode == "nounphrase":
            from app.extraction.nounphrase_extractor import NounPhraseExtractor
            extractors.append(NounPhraseExtractor(model_name=resolved.SPACY_MODEL))
        elif mode == "hybrid":
            from app.extraction.nounphrase_extractor import NounPhraseExtractor
            extractors.append(GLiNERExtractor(model_name=resolved.GLINER_MODEL))
            extractors.append(NounPhraseExtractor(model_name=resolved.SPACY_MODEL))
        else:
            extractors.append(GLiNERExtractor(model_name=resolved.GLINER_MODEL))
            
    return TermExtractionPipeline(extractors)
