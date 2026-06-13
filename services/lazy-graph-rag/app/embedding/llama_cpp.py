import os
from typing import List, Optional, Union, Any
from app.embedding.contracts import EmbeddingContract

class LlamaCppEmbedding(EmbeddingContract):
    def __init__(
        self,
        model_path: Optional[str] = None,
        context_size: Optional[int] = None,
        threads: Optional[int] = None,
    ):
        self._model = None
        self._model_path = model_path or os.environ.get("EMBEDDING_MODEL_PATH")
        self._context_size = context_size or int(os.environ.get("EMBEDDING_CONTEXT_SIZE", "8192"))
        self._threads = threads or int(os.environ.get("EMBEDDING_THREADS", str(max(1, (os.cpu_count() or 2) // 2))))
        
    def _get_model(self):
        if self._model is not None:
            return self._model
            
        if not self._model_path:
            raise RuntimeError("EMBEDDING_MODEL_PATH is not configured")
            
        try:
            from llama_cpp import Llama
            self._model = Llama(
                model_path=self._model_path,
                embedding=True,
                n_ctx=self._context_size,
                n_threads=self._threads,
                verbose=False,
            )
            return self._model
        except Exception as exc:
            raise RuntimeError(f"Embedding model load failed: {exc}") from exc

    def _extract_embedding_vector(self, result: Any) -> List[float]:
        try:
            embedding = result["data"][0]["embedding"]
            return [float(value) for value in embedding]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ValueError(f"embedding_malformed_response: {exc}")

    def create_embeddings(self, texts: Union[str, List[str]]) -> List[List[float]]:
        model = self._get_model()
        inputs = [texts] if isinstance(texts, str) else texts
        if not inputs:
            raise ValueError("embedding input must not be empty")

        embeddings = []
        for text in inputs:
            try:
                result = model.create_embedding(text)
                emb = self._extract_embedding_vector(result)
                embeddings.append(emb)
            except Exception as exc:
                raise RuntimeError(f"Embedding inference failed: {exc}") from exc

        return embeddings
