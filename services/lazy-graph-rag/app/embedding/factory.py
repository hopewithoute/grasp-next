from app.embedding.contracts import EmbeddingContract
from app.embedding.llama_cpp import LlamaCppEmbedding
from app.embedding.openai_compatible import OpenAICompatibleEmbedding
from app.settings import Settings, get_settings


def create_embedding_runtime(settings: Settings | None = None) -> EmbeddingContract:
    resolved = settings or get_settings()
    if resolved.EMBEDDING_BASE_URL:
        return OpenAICompatibleEmbedding(
            base_url=resolved.EMBEDDING_BASE_URL,
            token=resolved.EMBEDDING_API_KEY,
            model=resolved.EMBEDDING_MODEL,
        )
    if resolved.EMBEDDING_MODEL_PATH:
        return LlamaCppEmbedding(model_path=resolved.EMBEDDING_MODEL_PATH)

    raise RuntimeError("Configure EMBEDDING_BASE_URL or EMBEDDING_MODEL_PATH for LGS embeddings")
