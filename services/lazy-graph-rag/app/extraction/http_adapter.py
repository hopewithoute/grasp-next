import os
import httpx
from typing import List, Optional
from app.extraction.contracts import ExtractorContract, Chunk, ExtractionCandidate

class HTTPExtractorAdapter(ExtractorContract):
    def __init__(self, url: Optional[str] = None, token: Optional[str] = None):
        self.url = url or os.environ.get("TERM_EXTRACTOR_BASE_URL") or os.environ.get("GLINER_SIDECAR_URL")
        if not self.url:
            raise RuntimeError("TERM_EXTRACTOR_BASE_URL is not configured")
        self.token = token or os.environ.get("TERM_EXTRACTOR_API_KEY") or os.environ.get("GLINER_SIDECAR_API_KEY", "dev-secret-key")
        
    def extract_terms(self, chunks: List[Chunk], labels: List[str], threshold: float = 0.5, language_hint: Optional[str] = None) -> List[ExtractionCandidate]:
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {
            "chunks": [c.model_dump() for c in chunks],
            "labels": labels,
            "threshold": threshold,
            "languageHint": language_hint
        }
        
        try:
            with httpx.Client() as client:
                response = client.post(f"{self.url.rstrip('/')}/extract", json=payload, headers=headers, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                
                return [ExtractionCandidate(**cand) for cand in data.get("candidates", [])]
        except Exception as exc:
            raise RuntimeError(f"HTTP extractor inference failed: {exc}") from exc
