import pytest
from app.chunking.recursive import RecursiveChunker
from app.chunking.contracts import ChunkDocumentInput, ChunkingOptions

def chunk_document(input_data: ChunkDocumentInput, options: ChunkingOptions):
    return RecursiveChunker().chunk_document(input_data, options)

def test_chunk_document_empty_input():
    chunks = chunk_document(
        ChunkDocumentInput(content="", source_type="text"),
        ChunkingOptions(target_tokens=10, overlap_tokens=0, min_chunk_tokens=0)
    )
    assert chunks == []

def test_chunk_document_under_target_tokens():
    content = "Hello world"
    chunks = chunk_document(
        ChunkDocumentInput(content=content, source_type="text"),
        ChunkingOptions(target_tokens=10, overlap_tokens=0, min_chunk_tokens=0)
    )
    assert len(chunks) == 1
    assert chunks[0].content == content
    assert chunks[0].start_offset == 0
    assert chunks[0].end_offset == len(content)

def test_chunk_document_split_by_double_newline():
    content = "Paragraph one is here.\n\nParagraph two is here.\n\nParagraph three is here."
    chunks = chunk_document(
        ChunkDocumentInput(content=content, source_type="text"),
        ChunkingOptions(target_tokens=10, overlap_tokens=0, min_chunk_tokens=0)
    )
    assert len(chunks) == 3
    assert chunks[0].content == "Paragraph one is here.\n\n"
    assert chunks[1].content == "Paragraph two is here.\n\n"
    assert chunks[2].content == "Paragraph three is here."

def test_chunk_document_overlap_chunks():
    content = "Paragraph 1 is here.\n\nParagraph 2 is here.\n\nParagraph 3 is here."
    chunks = chunk_document(
        ChunkDocumentInput(content=content, source_type="text"),
        ChunkingOptions(target_tokens=10, overlap_tokens=5, min_chunk_tokens=0)
    )
    assert len(chunks) > 1
    assert chunks[1].start_offset < chunks[0].end_offset

def test_chunk_document_extract_headings_for_markdown():
    content = "# Main Title\n\nSome text here.\n\n## Subtitle\n\nMore text."
    chunks = chunk_document(
        ChunkDocumentInput(content=content, source_type="markdown"),
        ChunkingOptions(target_tokens=5, overlap_tokens=0, min_chunk_tokens=0)
    )
    
    subtitle_chunk = next((c for c in chunks if "More text" in c.content), None)
    assert subtitle_chunk is not None
    assert subtitle_chunk.heading_path == ["Main Title", "Subtitle"]

def test_chunk_document_deterministic():
    content = "A long document... " * 100
    run1 = chunk_document(
        ChunkDocumentInput(content=content, source_type="text"),
        ChunkingOptions(target_tokens=20, overlap_tokens=5, min_chunk_tokens=10)
    )
    run2 = chunk_document(
        ChunkDocumentInput(content=content, source_type="text"),
        ChunkingOptions(target_tokens=20, overlap_tokens=5, min_chunk_tokens=10)
    )
    assert run1 == run2
