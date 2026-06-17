import pytest
from unittest.mock import MagicMock
from app.query.claim_extractor import ClaimExtractor
from app.query.models import Claim

def test_claim_extractor_success():
    mock_generator = MagicMock()
    # Mock return value as JSON list of claim objects
    mock_generator.generate_direct.return_value = (
        '[{"claim": "Claim 1", "chunk_id": "c1"}, {"claim": "Claim 2", "chunk_id": "c2"}]'
    )
    
    extractor = ClaimExtractor(generator=mock_generator)
    chunks = [{"chunk_id": "c1", "content": "text 1"}, {"chunk_id": "c2", "content": "text 2"}]
    result = extractor.extract_claims("query context", chunks)
    
    assert len(result) == 2
    assert result[0].claim == "Claim 1"
    assert result[0].chunk_ids == ["c1"]
    assert result[1].claim == "Claim 2"
    assert result[1].chunk_ids == ["c2"]
    
    mock_generator.generate_direct.assert_called_once()
    assert "factual claim extractor" in mock_generator.generate_direct.call_args[0][0]

def test_claim_extractor_invalid_json():
    mock_generator = MagicMock()
    mock_generator.generate_direct.return_value = "invalid json payload"
    
    extractor = ClaimExtractor(generator=mock_generator)
    result = extractor.extract_claims("query context", [{"chunk_id": "c1"}])
    
    assert result == []

def test_claim_extractor_exception():
    mock_generator = MagicMock()
    mock_generator.generate_direct.side_effect = Exception("LLM connection error")
    
    extractor = ClaimExtractor(generator=mock_generator)
    result = extractor.extract_claims("query context", [{"chunk_id": "c1"}])
    
    assert result == []

def test_claim_extractor_empty_chunks():
    mock_generator = MagicMock()
    extractor = ClaimExtractor(generator=mock_generator)
    result = extractor.extract_claims("query context", [])
    
    assert result == []
    mock_generator.generate_direct.assert_not_called()

def test_claim_extractor_clean_markdown():
    mock_generator = MagicMock()
    mock_generator.generate_direct.return_value = '```json\n[{"claim": "Markdown Claim", "chunk_id": "c1"}]\n```'
    
    extractor = ClaimExtractor(generator=mock_generator)
    result = extractor.extract_claims("query context", [{"chunk_id": "c1"}])
    
    assert len(result) == 1
    assert result[0].claim == "Markdown Claim"
    assert result[0].chunk_ids == ["c1"]
