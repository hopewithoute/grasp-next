import os
import httpx
from typing import List, Optional, Union
from app.embedding.contracts import EmbeddingContract

class OpenAICompatibleEmbedding(EmbeddingContract):
    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None, model: Optional[str] = None):
        url = base_url or os.environ.get("EMBEDDING_BASE_URL") or os.environ.get("EMBEDDING_SIDECAR_URL")
        if not url:
            raise RuntimeError("EMBEDDING_BASE_URL is not configured")
        self.url = f"{url.rstrip('/')}/embeddings" if url.rstrip('/').endswith('/v1') else url.rstrip('/')
        self.token = token or os.environ.get("EMBEDDING_API_KEY", "dev-secret-key")
        self.model = model or os.environ.get("EMBEDDING_MODEL", "local-embedding-model")
        
    def create_embeddings(self, texts: Union[str, List[str]]) -> List[List[float]]:
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {
            "input": texts,
            "model": self.model
        }
        
        try:
            with httpx.Client() as client:
                response = client.post(self.url, json=payload, headers=headers, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                
                return [item.get("embedding", []) for item in data.get("data", [])]
        except Exception as exc:
            raise RuntimeError(f"HTTP embedding inference failed: {exc}") from exc
