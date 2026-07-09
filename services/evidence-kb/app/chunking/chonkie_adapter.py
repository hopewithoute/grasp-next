from typing import List
from pydantic import BaseModel
import logging
from chonkie import SemanticChunker


class DocumentChunk(BaseModel):
    index: int
    text: str
    start_offset: int
    end_offset: int
    estimated_tokens: int


logger = logging.getLogger(__name__)

logger.info("Eagerly initializing Chonkie SemanticChunker with potion-base-32M...")
_chunker = SemanticChunker(embedding_model="minishlab/potion-base-32M", chunk_size=512, similarity_window=2)


def get_chunker() -> SemanticChunker:
    return _chunker


def chunk_text_semantic(text: str) -> List[DocumentChunk]:
    """
    Chunks text using Chonkie SemanticChunker.
    Ignores arbitrary character limits in favor of semantic token limits.
    """
    normalized = text.replace("\r\n", "\n").strip()
    if not normalized:
        return []

    chunker = get_chunker()

    # 1. Semantic Chunking
    raw_chunks = chunker(normalized)

    # 2. Add overlap context per document
    # refined_chunks = refinery(raw_chunks) # REMOVED: OverlapRefinery cuts mid-word

    # 3. Map to internal schema
    results = []
    for i, c in enumerate(raw_chunks):
        results.append(
            DocumentChunk(
                index=i,
                text=c.text, # type: ignore
                start_offset=c.start_index, # type: ignore
                end_offset=c.end_index, # type: ignore
                estimated_tokens=getattr(c, "token_count", 0),
            )
        )
    return results


def chunk_texts_semantic_batch(texts: List[str]) -> List[List[DocumentChunk]]:
    """
    Chunks multiple texts using Chonkie SemanticChunker in batch mode.
    This provides significant performance benefits for multi-page PDFs or bulk ingestion.
    """
    normalized_texts = [text.replace("\r\n", "\n").strip() for text in texts]

    chunker = get_chunker()

    # 1. Semantic Chunking in Batch
    raw_chunks_batch = chunker(normalized_texts)

    batch_results = []
    for raw_chunks in raw_chunks_batch:
        if not raw_chunks:
            batch_results.append([])
            continue

        # 3. Map to internal schema
        results = []
        for i, c in enumerate(raw_chunks):
            results.append(
                DocumentChunk(
                    index=i,
                    text=c.text,  # type: ignore
                    start_offset=c.start_index,  # type: ignore
                    end_offset=c.end_index,  # type: ignore
                    estimated_tokens=c.token_count,  # type: ignore
                )
            )
        batch_results.append(results)

    return batch_results
