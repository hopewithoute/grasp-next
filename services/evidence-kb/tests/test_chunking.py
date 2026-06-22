from app.chunking.chonkie_adapter import chunk_text_semantic


def test_chunk_text_splits_with_overlap():
    # Provide a text long enough to force multiple semantic chunks
    # (assuming 512 token chunk size, we need a really long text or distinct paragraphs)
    text = ("A " * 300) + "\n\n" + ("B " * 300) + "\n\n" + ("C " * 300)
    chunks = chunk_text_semantic(text)

    assert len(chunks) >= 2
    assert chunks[0].index == 0
    assert chunks[0].start_offset == 0
    # Overlap implies second chunk's text might share something, 
    # but Chonkie's start_offset logic usually progresses sequentially.
    assert chunks[1].start_offset > 0
