from pydantic import BaseModel


class DocumentChunk(BaseModel):
    index: int
    text: str
    start_offset: int
    end_offset: int
    estimated_tokens: int


def chunk_text(text: str, target_chars: int, overlap_chars: int) -> list[DocumentChunk]:
    normalized = text.replace("\r\n", "\n").strip()
    if not normalized:
        return []

    chunks: list[DocumentChunk] = []
    start = 0
    index = 0
    text_len = len(normalized)

    while start < text_len:
        end = min(start + target_chars, text_len)
        if end < text_len:
            boundary = max(normalized.rfind("\n\n", start, end), normalized.rfind(". ", start, end))
            if boundary > start + int(target_chars * 0.5):
                end = boundary + 1

        chunk_body = normalized[start:end].strip()
        if chunk_body:
            chunks.append(
                DocumentChunk(
                    index=index,
                    text=chunk_body,
                    start_offset=start,
                    end_offset=end,
                    estimated_tokens=max(1, len(chunk_body) // 4),
                )
            )
            index += 1

        if end >= text_len:
            break
        start = max(end - overlap_chars, start + 1)

    return chunks
