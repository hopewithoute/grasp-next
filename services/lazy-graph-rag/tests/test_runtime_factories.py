from app.embedding.factory import create_embedding_runtime
from app.embedding.llama_cpp import LlamaCppEmbedding
from app.embedding.openai_compatible import OpenAICompatibleEmbedding
from app.extraction.factory import create_term_extractor
from app.extraction.gliner_extractor import GLiNERExtractor
from app.extraction.http_adapter import HTTPExtractorAdapter
from app.settings import Settings


def test_embedding_factory_prefers_openai_compatible_endpoint():
    runtime = create_embedding_runtime(
        Settings(
            EMBEDDING_BASE_URL="http://127.0.0.1:8766/v1",
            EMBEDDING_API_KEY="test-key",
            EMBEDDING_MODEL="opaque-embedding-model",
            EMBEDDING_MODEL_PATH="/local/model.gguf",
        )
    )

    assert isinstance(runtime, OpenAICompatibleEmbedding)
    assert runtime.url == "http://127.0.0.1:8766/v1/embeddings"
    assert runtime.model == "opaque-embedding-model"


def test_embedding_factory_uses_llama_cpp_when_model_path_is_configured():
    runtime = create_embedding_runtime(Settings(EMBEDDING_MODEL_PATH="/local/model.gguf", EMBEDDING_BASE_URL=None))

    assert isinstance(runtime, LlamaCppEmbedding)


def test_extractor_factory_prefers_http_endpoint():
    runtime = create_term_extractor(
        Settings(
            TERM_EXTRACTOR_BASE_URL="http://127.0.0.1:8765",
            TERM_EXTRACTOR_API_KEY="test-key",
        )
    )

    from app.extraction.pipeline import TermExtractionPipeline
    assert isinstance(runtime, TermExtractionPipeline)
    assert isinstance(runtime.extractor, HTTPExtractorAdapter)
    assert runtime.extractor.url == "http://127.0.0.1:8765"


def test_extractor_factory_uses_gliner_in_process_by_default():
    runtime = create_term_extractor(Settings(GLINER_MODEL="opaque-gliner-model"))

    from app.extraction.pipeline import TermExtractionPipeline
    assert isinstance(runtime, TermExtractionPipeline)
    assert isinstance(runtime.extractor, GLiNERExtractor)


def test_extractor_factory_uses_nounphrase():
    runtime = create_term_extractor(
        Settings(
            TERM_EXTRACTOR_MODE="nounphrase",
            SPACY_MODEL="en_core_web_sm"
        )
    )
    
    from app.extraction.pipeline import TermExtractionPipeline
    from app.extraction.nounphrase_extractor import NounPhraseExtractor
    assert isinstance(runtime, TermExtractionPipeline)
    assert isinstance(runtime.extractor, NounPhraseExtractor)


def test_extractor_factory_uses_hybrid():
    runtime = create_term_extractor(
        Settings(
            TERM_EXTRACTOR_MODE="hybrid",
            GLINER_MODEL="opaque-gliner-model",
            SPACY_MODEL="en_core_web_sm"
        )
    )
    
    from app.extraction.pipeline import TermExtractionPipeline
    from app.extraction.nounphrase_extractor import NounPhraseExtractor
    assert isinstance(runtime, TermExtractionPipeline)
    assert len(runtime.extractors) == 2
    assert isinstance(runtime.extractors[0], GLiNERExtractor)
    assert isinstance(runtime.extractors[1], NounPhraseExtractor)
