from typing import List, Dict, Any, Tuple
from app.query.models import RetrievedContext, Citation

class ContextPacker:
    def __init__(self, max_tokens: int = 4000, chars_per_token: int = 4):
        self.max_tokens = max_tokens
        self.max_chars = max_tokens * chars_per_token

    def pack(self, chunks: List[Dict[str, Any]]) -> Tuple[List[RetrievedContext], List[Citation]]:
        """
        Takes a list of chunk dictionaries from retrieval and packs them into
        RetrievedContext and Citation objects up to a character budget.
        """
        packed_contexts = []
        citations = []
        current_chars = 0

        for chunk in chunks:
            content_length = len(chunk.get("content", ""))
            
            if current_chars + content_length > self.max_chars and packed_contexts:
                # Stop packing if we exceed the budget and already have at least one context
                break

            ctx = RetrievedContext(
                chunkId=chunk["chunk_id"],
                documentId=chunk["document_id"],
                content=chunk["content"],
                score=chunk.get("score", 0.0),
                startOffset=chunk["start_offset"],
                endOffset=chunk["end_offset"]
            )
            packed_contexts.append(ctx)

            cit = Citation(
                chunkId=chunk["chunk_id"],
                documentId=chunk["document_id"],
                startOffset=chunk["start_offset"],
                endOffset=chunk["end_offset"]
            )
            citations.append(cit)

            current_chars += content_length

        return packed_contexts, citations
