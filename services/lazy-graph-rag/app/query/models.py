from pydantic import BaseModel
from typing import List, Optional

class Citation(BaseModel):
    chunkId: str
    documentId: str
    startOffset: int
    endOffset: int

class RetrievedContext(BaseModel):
    chunkId: str
    documentId: str
    content: str
    score: float
    startOffset: int
    endOffset: int

class Claim(BaseModel):
    claim: str
    chunk_ids: List[str]
    subquery: Optional[str] = None
