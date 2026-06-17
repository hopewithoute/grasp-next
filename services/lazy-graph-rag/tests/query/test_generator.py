import pytest
from app.query.generator import DeterministicTestGenerator
from app.api.query import RetrievedContext

def test_deterministic_generator():
    generator = DeterministicTestGenerator()
    
    contexts = [
        RetrievedContext(
            chunkId="c1", documentId="d1", content="some content", score=0.9, startOffset=0, endOffset=10
        )
    ]
    
    # Test fallback
    ans = generator.generate_answer("What is this?", contexts)
    assert ans == "This is a deterministic answer based on the context."
    
    # Test specific keyword
    ans = generator.generate_answer("Tell me about pgvector", contexts)
    assert ans == "pgvector provides vector similarity search in PostgreSQL."

    # Test empty contexts
    ans = generator.generate_answer("Hello", [])
    assert ans == "No context provided to answer the query."

from unittest.mock import patch, MagicMock
from app.query.generator import OpenAIGenerator
from app.settings import Settings

def test_openai_generator():
    settings = Settings(GENERATOR_API_KEY="test-key", GENERATOR_MODEL="test-model", GENERATOR_BASE_URL="http://test")
    
    with patch("httpx.Client") as mock_client_class:
        mock_client = MagicMock()
        mock_client.__enter__.return_value = mock_client
        mock_client_class.return_value = mock_client
        
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "This is an AI generated answer."}}]
        }
        mock_client.post.return_value = mock_resp
        
        generator = OpenAIGenerator(settings)
        contexts = [
            RetrievedContext(
                chunkId="c1", documentId="d1", content="some content", score=0.9, startOffset=0, endOffset=10
            )
        ]
        
        ans = generator.generate_answer("What is this?", contexts)
        assert ans == "This is an AI generated answer."
        
        # Verify the client was called with correct structure
        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert call_args[1]["headers"]["Authorization"] == "Bearer test-key"
        assert call_args[1]["json"]["model"] == "test-model"
        
        messages = call_args[1]["json"]["messages"]
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert "What is this?" in messages[1]["content"]
