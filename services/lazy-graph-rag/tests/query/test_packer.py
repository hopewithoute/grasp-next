import pytest
from app.query.packer import ContextPacker

def test_context_packer_budget_limits():
    packer = ContextPacker(max_tokens=10, chars_per_token=4) # max 40 chars
    
    chunks = [
        {"chunk_id": "c1", "document_id": "d1", "content": "1234567890", "start_offset": 0, "end_offset": 10, "score": 0.9}, # 10 chars
        {"chunk_id": "c2", "document_id": "d1", "content": "12345678901234567890", "start_offset": 10, "end_offset": 30, "score": 0.8}, # 20 chars
        {"chunk_id": "c3", "document_id": "d1", "content": "12345678901234567890", "start_offset": 30, "end_offset": 50, "score": 0.7}, # 20 chars
    ]
    
    contexts, citations = packer.pack(chunks)
    
    # Should only pack c1 and c2 (10 + 20 = 30 chars). c3 would exceed 40 limit.
    assert len(contexts) == 2
    assert len(citations) == 2
    
    assert contexts[0].chunkId == "c1"
    assert contexts[1].chunkId == "c2"
    assert citations[0].chunkId == "c1"
    assert citations[1].chunkId == "c2"

def test_context_packer_at_least_one():
    packer = ContextPacker(max_tokens=1, chars_per_token=4) # max 4 chars
    
    chunks = [
        {"chunk_id": "c1", "document_id": "d1", "content": "1234567890", "start_offset": 0, "end_offset": 10, "score": 0.9}, # 10 chars
    ]
    
    contexts, citations = packer.pack(chunks)
    
    # Even though 10 chars > 4 chars, we should pack at least the first context.
    # Wait, the logic stops if current_chars + content_length > max_chars and packed_contexts is not empty.
    assert len(contexts) == 1
    assert contexts[0].chunkId == "c1"
