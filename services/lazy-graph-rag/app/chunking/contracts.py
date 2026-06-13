from typing import List, Literal, Optional
from pydantic import BaseModel

class ChunkDocumentInput(BaseModel):
    document_id: Optional[str] = None
    content: str
    source_type: Literal["text", "markdown"]

class ChunkingOptions(BaseModel):
    target_tokens: int
    overlap_tokens: int
    min_chunk_tokens: int

class DocumentChunk(BaseModel):
    chunk_index: int
    content: str
    start_offset: int
    end_offset: int
    estimated_tokens: int
    heading_path: List[str]
