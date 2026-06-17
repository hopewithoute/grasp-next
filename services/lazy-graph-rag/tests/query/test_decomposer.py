import pytest
from unittest.mock import MagicMock
from app.query.query_decomposer import QueryDecomposer
from app.query.generator import DeterministicTestGenerator

def test_query_decomposer_success():
    # Use a mock generator that returns a valid JSON array
    mock_generator = MagicMock()
    mock_generator.generate_direct.return_value = '["what is vector database", "how does pgvector index work"]'
    
    decomposer = QueryDecomposer(generator=mock_generator)
    result = decomposer.decompose("how to use pgvector as vector database", 3)
    
    assert result == ["what is vector database", "how does pgvector index work"]
    mock_generator.generate_direct.assert_called_once()
    assert "at most 3 sub-queries" in mock_generator.generate_direct.call_args[0][1]

def test_query_decomposer_fallback_invalid_json():
    mock_generator = MagicMock()
    mock_generator.generate_direct.return_value = "not a json list"
    
    decomposer = QueryDecomposer(generator=mock_generator)
    result = decomposer.decompose("complex query", 3)
    
    assert result == ["complex query"]

def test_query_decomposer_fallback_generator_exception():
    mock_generator = MagicMock()
    mock_generator.generate_direct.side_effect = Exception("Inference failed")
    
    decomposer = QueryDecomposer(generator=mock_generator)
    result = decomposer.decompose("complex query", 3)
    
    assert result == ["complex query"]

def test_query_decomposer_clean_markdown():
    mock_generator = MagicMock()
    mock_generator.generate_direct.return_value = '```json\n["sub1", "sub2"]\n```'
    
    decomposer = QueryDecomposer(generator=mock_generator)
    result = decomposer.decompose("complex query", 3)
    
    assert result == ["sub1", "sub2"]

def test_query_decomposer_disabled():
    # Test setting disabled
    from app.settings import Settings
    mock_generator = MagicMock()
    
    decomposer = QueryDecomposer(generator=mock_generator)
    # Mock settings to set DECOMPOSER_ENABLED to False
    decomposer.settings = Settings(DECOMPOSER_ENABLED=False)
    
    result = decomposer.decompose("complex query", 3)
    assert result == ["complex query"]
    mock_generator.generate_direct.assert_not_called()
