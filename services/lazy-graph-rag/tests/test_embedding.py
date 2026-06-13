import pytest
from unittest.mock import patch, MagicMock
from app.embedding.llama_cpp import LlamaCppEmbedding
import os

@patch.object(LlamaCppEmbedding, '_get_model')
def test_llama_cpp_embedding(mock_get_model):
    # Setup mock
    mock_model = MagicMock()
    # Mocking llama.cpp response shape
    mock_model.create_embedding.return_value = {
        "data": [
            {
                "embedding": [0.1] * 1024
            }
        ]
    }
    mock_get_model.return_value = mock_model

    # Set required env var
    os.environ["EMBEDDING_MODEL_PATH"] = "/fake/path.gguf"
    
    embedder = LlamaCppEmbedding()
    
    result = embedder.create_embeddings(["hello text"])
    
    assert len(result) == 1
    assert len(result[0]) == 1024
    assert result[0][0] == 0.1
    
    mock_model.create_embedding.assert_called_once_with("hello text")
