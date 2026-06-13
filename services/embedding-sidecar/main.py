from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from typing import Any, List, Optional, Union
import os


app = FastAPI(
    title="Embedding Sidecar",
    description="OpenAI-compatible local embedding service for LazyGraphRAG",
)
security = HTTPBearer()

_embedding_model = None
_embedding_model_path = os.environ.get("EMBEDDING_MODEL_PATH")
_embedding_model_name = os.environ.get("EMBEDDING_MODEL", "local-embedding-model")
_embedding_context_size = int(os.environ.get("EMBEDDING_CONTEXT_SIZE", "8192"))
_embedding_threads = int(os.environ.get("EMBEDDING_THREADS", str(max(1, (os.cpu_count() or 2) // 2))))


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    expected_token = os.environ.get("EMBEDDING_API_KEY", "dev-secret-key")
    if credentials.credentials != expected_token:
        raise HTTPException(status_code=401, detail="Invalid token")
    return credentials.credentials


class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]]
    model: Optional[str] = None
    dimensions: Optional[int] = None


class EmbeddingUsage(BaseModel):
    prompt_tokens: int
    total_tokens: int


class EmbeddingItem(BaseModel):
    object: str = "embedding"
    index: int
    embedding: List[float]


class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: List[EmbeddingItem]
    model: str
    usage: EmbeddingUsage


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest, token: str = Depends(verify_token)):
    model = get_embedding_model()
    inputs = [request.input] if isinstance(request.input, str) else request.input
    if not inputs:
        raise HTTPException(status_code=400, detail="embedding input must not be empty")

    data: List[EmbeddingItem] = []
    prompt_tokens = 0

    try:
        for index, text in enumerate(inputs):
            result = model.create_embedding(text)
            embedding = extract_embedding_vector(result)
            if request.dimensions is not None and len(embedding) != request.dimensions:
                raise ValueError(
                    f"embedding_dimensions_mismatch: expected {request.dimensions}, got {len(embedding)}"
                )
            data.append(EmbeddingItem(index=index, embedding=embedding))
            prompt_tokens += count_embedding_tokens(result, text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding inference failed: {exc}") from exc

    return EmbeddingResponse(
        data=data,
        model=request.model or _embedding_model_name,
        usage=EmbeddingUsage(prompt_tokens=prompt_tokens, total_tokens=prompt_tokens),
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/metadata")
async def metadata():
    return {
        "model": _embedding_model_name,
        "modelPathConfigured": bool(_embedding_model_path),
        "loaded": _embedding_model is not None,
        "contextSize": _embedding_context_size,
        "threads": _embedding_threads,
    }


def get_embedding_model():
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model
    if not _embedding_model_path:
        raise HTTPException(status_code=503, detail="EMBEDDING_MODEL_PATH is not configured")

    try:
        from llama_cpp import Llama

        _embedding_model = Llama(
            model_path=_embedding_model_path,
            embedding=True,
            n_ctx=_embedding_context_size,
            n_threads=_embedding_threads,
            verbose=False,
        )
        return _embedding_model
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding model load failed: {exc}") from exc


def extract_embedding_vector(result: Any) -> List[float]:
    if not isinstance(result, dict):
        raise ValueError("embedding_malformed_response")

    data = result.get("data")
    if not isinstance(data, list) or not data:
        raise ValueError("embedding_missing_data")

    first_item = data[0]
    if not isinstance(first_item, dict):
        raise ValueError("embedding_invalid_item")

    embedding = first_item.get("embedding")
    if not isinstance(embedding, list) or not all(isinstance(value, (int, float)) for value in embedding):
        raise ValueError("embedding_invalid_vector")

    return [float(value) for value in embedding]


def count_embedding_tokens(result: Any, text: str) -> int:
    if isinstance(result, dict):
        usage = result.get("usage")
        if isinstance(usage, dict):
            prompt_tokens = usage.get("prompt_tokens")
            if isinstance(prompt_tokens, int):
                return prompt_tokens
    return len(text.split())
