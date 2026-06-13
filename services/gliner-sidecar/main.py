from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import os

app = FastAPI(title="GLiNER Sidecar", description="Local term extraction service for LazyGraphRAG")
security = HTTPBearer()
_model = None
_model_name = os.environ.get("GLINER_MODEL", "urchade/gliner_medium-v2.1")
_default_threshold = float(os.environ.get("GLINER_THRESHOLD", "0.5"))

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    expected_token = os.environ.get(
        "TERM_EXTRACTOR_API_KEY",
        os.environ.get("GLINER_SIDECAR_API_KEY", "dev-secret-key"),
    )
    if credentials.credentials != expected_token:
        raise HTTPException(status_code=401, detail="Invalid token")
    return credentials.credentials

class Chunk(BaseModel):
    chunkId: str
    content: str

class ExtractionRequest(BaseModel):
    chunks: List[Chunk]
    labels: List[str]
    threshold: Optional[float] = None
    languageHint: Optional[str] = None

class ExtractionCandidate(BaseModel):
    chunkId: str
    text: str
    label: str
    startOffset: int
    endOffset: int
    confidence: float

class ModelMetadata(BaseModel):
    name: str
    version: Optional[str] = None

class ExtractionResponse(BaseModel):
    candidates: List[ExtractionCandidate]
    model: ModelMetadata
    extractor: ModelMetadata

@app.post("/extract", response_model=ExtractionResponse)
async def extract_terms(request: ExtractionRequest, token: str = Depends(verify_token)):
    model = get_model()
    threshold = request.threshold if request.threshold is not None else _default_threshold
    candidates: List[ExtractionCandidate] = []

    for chunk in request.chunks:
        try:
            entities = model.predict_entities(chunk.content, request.labels, threshold=threshold)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"GLiNER inference failed: {exc}") from exc

        for entity in entities:
            start = int(entity.get("start", entity.get("startOffset", -1)))
            end = int(entity.get("end", entity.get("endOffset", -1)))
            text = str(entity.get("text", ""))
            label = str(entity.get("label", ""))
            confidence = float(entity.get("score", entity.get("confidence", 0.0)))

            if start < 0 or end <= start or end > len(chunk.content) or not text or not label:
                continue

            candidates.append(
                ExtractionCandidate(
                    chunkId=chunk.chunkId,
                    text=text,
                    label=label,
                    startOffset=start,
                    endOffset=end,
                    confidence=confidence,
                )
            )

    return ExtractionResponse(
        candidates=candidates,
        model=ModelMetadata(name=_model_name),
        extractor=ModelMetadata(name=_model_name),
    )

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/metadata")
async def metadata():
    return {
        "model": _model_name,
        "loaded": _model is not None,
    }

def get_model():
    global _model
    if _model is not None:
        return _model

    try:
        from gliner import GLiNER

        _model = GLiNER.from_pretrained(_model_name)
        return _model
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GLiNER model load failed: {exc}") from exc
