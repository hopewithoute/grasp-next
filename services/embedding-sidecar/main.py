from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from typing import Any, List, Optional, Union
import os
import tiktoken
import hmac
from anyio import to_thread
from threading import Lock
import asyncio


app = FastAPI(
    title="Embedding Sidecar",
    description="OpenAI-compatible local embedding service for LazyGraphRAG",
)
security = HTTPBearer()

_embedding_model = None
_embedding_model_path = os.environ.get("EMBEDDING_MODEL_PATH")
_embedding_model_name = os.environ.get("EMBEDDING_MODEL", "local-embedding-model")
_embedding_context_size = int(os.environ.get("EMBEDDING_CONTEXT_SIZE", "8192"))
_embedding_threads = int(
    os.environ.get("EMBEDDING_THREADS", str(max(1, (os.cpu_count() or 2) // 2)))
)
_embedding_gpu_layers = int(os.environ.get("EMBEDDING_GPU_LAYERS", "-1"))
_embedding_batch_size = int(os.environ.get("EMBEDDING_BATCH_SIZE", "512"))
_embedding_ubatch_size = int(os.environ.get("EMBEDDING_UBATCH_SIZE", "512"))
_embedding_threads_batch = int(
    os.environ.get("EMBEDDING_THREADS_BATCH", str(_embedding_threads))
)

_max_batch_size = int(os.environ.get("EMBEDDING_MAX_BATCH_SIZE", "128"))
_max_input_chars = int(os.environ.get("EMBEDDING_MAX_INPUT_CHARS", "20000"))

_model_lock = Lock()


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    expected_token = os.environ.get("EMBEDDING_API_KEY", "dev-secret-key")
    if not hmac.compare_digest(credentials.credentials, expected_token):
        raise HTTPException(status_code=401, detail="Invalid token")
    return credentials.credentials


class EmbeddingRequest(BaseModel):
    input: Union[str, List[str], List[int], List[List[int]]]
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


class BatchRequest:
    def __init__(self, inputs: List[str], model_name: str):
        self.inputs = inputs
        self.model_name = model_name
        self.future = asyncio.get_running_loop().create_future()


_batch_queue: Optional[asyncio.Queue] = None


async def batch_worker():
    while True:
        requests = []
        try:
            req = await _batch_queue.get()
            requests.append(req)

            current_len = len(req.inputs)
            while len(requests) < 32:
                try:
                    next_req = await asyncio.wait_for(_batch_queue.get(), timeout=0.05)
                    if current_len + len(next_req.inputs) > _max_batch_size:
                        # Put it back to the queue and stop accumulating
                        await _batch_queue.put(next_req)
                        break
                    requests.append(next_req)
                    current_len += len(next_req.inputs)
                except asyncio.TimeoutError:
                    break

            combined_inputs = []
            for r in requests:
                combined_inputs.extend(r.inputs)

            if not combined_inputs:
                continue

            model_name = requests[0].model_name

            def _work():
                with _model_lock:
                    model = get_embedding_model()
                    return model.create_embedding(combined_inputs, model=model_name)

            result = await to_thread.run_sync(_work)
            items = extract_embedding_items(result)
            prompt_tokens = extract_prompt_tokens(result)

            offset = 0
            for r in requests:
                length = len(r.inputs)
                r_items = items[offset : offset + length]
                if not r.future.done():
                    est_tokens = (
                        prompt_tokens // len(requests) if len(requests) > 0 else 0
                    )
                    r.future.set_result((r_items, est_tokens))
                offset += length

        except Exception as e:
            for r in requests:
                if not r.future.done():
                    r.future.set_exception(e)


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(
    request: EmbeddingRequest, token: str = Depends(verify_token)
):
    inputs = _normalize_input(request.input)

    if len(inputs) > _max_batch_size:
        raise HTTPException(
            status_code=400, detail=f"too_many_inputs: max {_max_batch_size}"
        )

    for text in inputs:
        if len(text) > _max_input_chars:
            raise HTTPException(
                status_code=400, detail=f"input_too_large: max {_max_input_chars} chars"
            )

    req = BatchRequest(inputs, request.model or _embedding_model_name)
    await _batch_queue.put(req)

    try:
        r_items, est_tokens = await req.future
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Embedding inference failed: {exc}"
        ) from exc

    data: List[EmbeddingItem] = []
    for index, embedding in enumerate(r_items):
        if request.dimensions is not None and len(embedding) != request.dimensions:
            raise HTTPException(
                status_code=400,
                detail=f"embedding_dimensions_mismatch: expected {request.dimensions}, got {len(embedding)}",
            )

        data.append(EmbeddingItem(index=index, embedding=embedding))

    return EmbeddingResponse(
        data=data,
        model=request.model or _embedding_model_name,
        usage=EmbeddingUsage(prompt_tokens=est_tokens, total_tokens=est_tokens),
    )


def _normalize_input(
    raw_input: Union[str, List[str], List[int], List[List[int]]],
) -> List[str]:
    if isinstance(raw_input, str):
        return [raw_input]

    if not isinstance(raw_input, list) or len(raw_input) == 0:
        raise HTTPException(status_code=400, detail="embedding input must not be empty")

    first_elem = raw_input[0]
    if isinstance(first_elem, str):
        return raw_input
    elif isinstance(first_elem, int):
        enc = tiktoken.get_encoding("cl100k_base")
        return [enc.decode(raw_input)]
    elif isinstance(first_elem, list):
        enc = tiktoken.get_encoding("cl100k_base")
        return [enc.decode(tokens) for tokens in raw_input]

    raise HTTPException(status_code=400, detail="embedding input format not supported")


@app.on_event("startup")
def warmup_model():
    global _batch_queue
    _batch_queue = asyncio.Queue()
    asyncio.create_task(batch_worker())

    model = get_embedding_model()
    try:
        model.create_embedding("warmup")
    except Exception as e:
        print(f"Warmup failed: {e}")


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
        "gpuLayers": _embedding_gpu_layers,
    }


def get_embedding_model():
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model
    if not _embedding_model_path:
        raise HTTPException(
            status_code=503, detail="EMBEDDING_MODEL_PATH is not configured"
        )

    try:
        from llama_cpp import Llama

        _embedding_model = Llama(
            model_path=_embedding_model_path,
            embedding=True,
            n_ctx=_embedding_context_size,
            n_threads=_embedding_threads,
            n_threads_batch=_embedding_threads_batch,
            n_batch=_embedding_batch_size,
            n_ubatch=_embedding_ubatch_size,
            n_gpu_layers=_embedding_gpu_layers,
            verbose=False,
        )
        return _embedding_model
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Embedding model load failed: {exc}"
        ) from exc


def extract_embedding_items(result: Any) -> List[List[float]]:
    if not isinstance(result, dict):
        raise ValueError("embedding_malformed_response")

    data = result.get("data")
    if not isinstance(data, list) or not data:
        raise ValueError("embedding_missing_data")

    embeddings: List[List[float]] = []

    for item in data:
        if not isinstance(item, dict):
            raise ValueError("embedding_invalid_item")

        embedding = item.get("embedding")
        if not isinstance(embedding, list) or not all(
            isinstance(v, (int, float)) for v in embedding
        ):
            raise ValueError("embedding_invalid_vector")

        embeddings.append([float(v) for v in embedding])

    return embeddings


def extract_prompt_tokens(result: Any) -> int:
    if isinstance(result, dict):
        usage = result.get("usage")
        if isinstance(usage, dict):
            prompt_tokens = usage.get("prompt_tokens")
            if isinstance(prompt_tokens, int):
                return prompt_tokens
    return 0
