from app.chunking.recursive import chunk_text


def test_chunk_text_splits_with_overlap():
    text = "A" * 100 + ". " + "B" * 100 + ". " + "C" * 100
    chunks = chunk_text(text, target_chars=120, overlap_chars=20)

    assert len(chunks) >= 2
    assert chunks[0].index == 0
    assert chunks[0].start_offset == 0
    assert chunks[1].start_offset < chunks[0].end_offset
