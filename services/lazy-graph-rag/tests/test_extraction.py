import pytest
from unittest.mock import patch, MagicMock
from app.extraction.gliner_extractor import GLiNERExtractor
from app.extraction.contracts import Chunk

@patch.object(GLiNERExtractor, '_get_model')
def test_gliner_extractor(mock_get_model):
    # Mock the GLiNER model behavior
    mock_model = MagicMock()
    mock_model.predict_entities.return_value = [
        {"start": 0, "end": 5, "text": "Hello", "label": "GREETING", "score": 0.95}
    ]
    mock_get_model.return_value = mock_model

    extractor = GLiNERExtractor()
    chunks = [Chunk(chunkId="chunk-1", content="Hello world")]
    
    candidates = extractor.extract_terms(chunks=chunks, labels=["GREETING"])
    
    assert len(candidates) == 1
    assert candidates[0].text == "Hello"
    assert candidates[0].label == "GREETING"
    assert candidates[0].confidence == 0.95
    assert candidates[0].startOffset == 0
    assert candidates[0].endOffset == 5
    assert candidates[0].chunkId == "chunk-1"

    # Verify the underlying call
    mock_model.predict_entities.assert_called_once_with("Hello world", ["GREETING"], threshold=0.5)
