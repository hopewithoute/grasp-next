import pytest
from app.extraction.nounphrase_extractor import NounPhraseExtractor
from app.extraction.contracts import Chunk
from app.settings import Settings

def test_nounphrase_extractor_success():
    extractor = NounPhraseExtractor()
    chunks = [Chunk(chunkId="c1", content="The quick brown fox jumps over the lazy dog.")]
    
    candidates = extractor.extract_terms(chunks=chunks, labels=["concept"])
    
    assert len(candidates) >= 2
    # It should extract "The quick brown fox" (or "quick brown fox") and "the lazy dog" (or "lazy dog")
    extracted_texts = [cand.text.lower() for cand in candidates]
    
    # Verify that at least some part of the noun phrases are present
    assert any("fox" in text for text in extracted_texts)
    assert any("dog" in text for text in extracted_texts)
    
    # Assert label is concept
    for cand in candidates:
        assert cand.label == "concept"
        assert cand.confidence == 1.0

def test_nounphrase_extractor_stops_and_short():
    extractor = NounPhraseExtractor()
    # "is", "a", "the" are stopwords, "x" is too short
    chunks = [Chunk(chunkId="c2", content="is a the x")]
    
    candidates = extractor.extract_terms(chunks=chunks, labels=["concept"])
    assert len(candidates) == 0
