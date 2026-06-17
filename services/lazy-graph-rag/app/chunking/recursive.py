import re
import math
from typing import List
from pydantic import BaseModel

class Span(BaseModel):
    text: str
    start_offset: int
    end_offset: int

class Heading(BaseModel):
    level: int
    text: str
    start_offset: int
    end_offset: int

SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", " ", ""]

def estimate_tokens(text: str) -> int:
    return max(1, math.ceil(len(text) / 4.0))

def split_text(span: Span, separators: List[str]) -> List[Span]:
    for separator in separators:
        if not separator:
            return [
                Span(text=char, start_offset=span.start_offset + idx, end_offset=span.start_offset + idx + 1)
                for idx, char in enumerate(span.text)
            ]
        
        parts = span.text.split(separator)
        if len(parts) > 1:
            spans = []
            current_offset = span.start_offset
            for i, part in enumerate(parts):
                text = part + (separator if i < len(parts) - 1 else "")
                if text:
                    spans.append(Span(text=text, start_offset=current_offset, end_offset=current_offset + len(text)))
                current_offset += len(text)
            return spans
    return [span]

def recursively_split(span: Span, target_tokens: int) -> List[Span]:
    if estimate_tokens(span.text) <= target_tokens:
        return [span]
    
    splits = split_text(span, SEPARATORS)
    if len(splits) == 1 and splits[0].text == span.text:
        return [span]
    
    result = []
    for s in splits:
        result.extend(recursively_split(s, target_tokens))
    return result

def _get_partial_overlap(span: Span, needed_tokens: int) -> List[Span]:
    """Extracts a suffix from `span` that is roughly `needed_tokens` long."""
    result = []
    tokens = 0
    smaller_spans = recursively_split(span, max(1, needed_tokens // 2))
    
    for s in reversed(smaller_spans):
        s_tokens = estimate_tokens(s.text)
        if tokens + s_tokens <= needed_tokens:
            result.insert(0, s)
            tokens += s_tokens
        else:
            chars_needed = (needed_tokens - tokens) * 4
            if chars_needed > 0 and s.text:
                cut_index = max(0, len(s.text) - chars_needed)
                partial_span = Span(
                    text=s.text[cut_index:],
                    start_offset=s.start_offset + cut_index,
                    end_offset=s.end_offset
                )
                result.insert(0, partial_span)
            break
            
    return result

def get_overlap_spans(spans: List[Span], overlap_tokens: int) -> List[Span]:
    tokens = 0
    result = []
    for span in reversed(spans):
        span_tokens = estimate_tokens(span.text)
        if tokens + span_tokens <= overlap_tokens:
            result.insert(0, span)
            tokens += span_tokens
            if tokens == overlap_tokens:
                break
        else:
            needed = overlap_tokens - tokens
            if needed > 0:
                partial_spans = _get_partial_overlap(span, needed)
                result = partial_spans + result
            break
            
    return result

def _create_chunk_span(spans: List[Span]) -> Span:
    return Span(
        text="".join(s.text for s in spans),
        start_offset=spans[0].start_offset,
        end_offset=spans[-1].end_offset
    )

def pack_spans(spans: List[Span], options: ChunkingOptions) -> List[Span]:
    chunks = []
    current_spans: List[Span] = []

    for span in spans:
        span_tokens = estimate_tokens(span.text)
        current_tokens = estimate_tokens("".join(s.text for s in current_spans))

        if not current_spans or current_tokens + span_tokens <= options.target_tokens:
            current_spans.append(span)
        else:
            chunks.append(_create_chunk_span(current_spans))
            overlap_spans = get_overlap_spans(current_spans, options.overlap_tokens)
            current_spans = overlap_spans + [span]

    if current_spans:
        final_span = _create_chunk_span(current_spans)
        if final_span.text.strip():
            chunks.append(final_span)

    return chunks

def extract_headings(content: str) -> List[Heading]:
    pattern = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
    return [
        Heading(
            level=len(m.group(1)),
            text=m.group(2).strip(),
            start_offset=m.start(),
            end_offset=m.end()
        )
        for m in pattern.finditer(content)
    ]

def get_heading_path(offset: int, headings: List[Heading]) -> List[str]:
    active_headings = []
    for h in headings:
        if h.start_offset <= offset:
            while active_headings and active_headings[-1].level >= h.level:
                active_headings.pop()
            active_headings.append(h)
        else:
            break
    return [h.text for h in active_headings]

from app.chunking.contracts import ChunkerContract, ChunkDocumentInput, ChunkingOptions, DocumentChunk

class RecursiveChunker(ChunkerContract):
    def chunk_document(self, input_data: ChunkDocumentInput, options: ChunkingOptions) -> List[DocumentChunk]:
        if not input_data.content:
            return []

        initial_span = Span(
            text=input_data.content,
            start_offset=0,
            end_offset=len(input_data.content)
        )

        split_spans = recursively_split(initial_span, options.target_tokens)
        packed_spans = pack_spans(split_spans, options)

        headings = extract_headings(input_data.content) if input_data.source_type == "markdown" else []

        return [
            DocumentChunk(
                chunk_index=idx,
                content=span.text,
                start_offset=span.start_offset,
                end_offset=span.end_offset,
                estimated_tokens=estimate_tokens(span.text),
                heading_path=get_heading_path(span.start_offset, headings)
            )
            for idx, span in enumerate(packed_spans)
        ]
