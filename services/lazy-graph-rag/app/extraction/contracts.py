from pydantic import BaseModel
from typing import List, Optional

class Chunk(BaseModel):
    chunkId: str
    content: str

class ExtractionCandidate(BaseModel):
    chunkId: str
    text: str
    label: str
    startOffset: int
    endOffset: int
    confidence: float

class ExtractorContract:
    def extract_terms(self, chunks: List[Chunk], labels: List[str], threshold: float = 0.5, language_hint: Optional[str] = None) -> List[ExtractionCandidate]:
        raise NotImplementedError
