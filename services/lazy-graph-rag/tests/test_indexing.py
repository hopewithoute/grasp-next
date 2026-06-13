import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.indexing.source_indexer import SourceIndexer
from app.extraction.contracts import ExtractionCandidate

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture
def mock_session():
    return AsyncMock()

@pytest.fixture
def mock_repo():
    repo = AsyncMock()
    repo.get_document_by_source.return_value = None
    repo.save_indexed_source.return_value = "fake_doc_id"
    return repo

@patch('app.indexing.source_indexer.SourceRepository')
@patch('app.indexing.source_indexer.create_term_extractor')
@patch('app.indexing.source_indexer.create_embedding_runtime')
@pytest.mark.anyio
async def test_index_source_new(mock_embedding_factory, mock_extractor_factory, mock_repo_class, mock_session):
    mock_repo = AsyncMock()
    mock_repo.get_document_by_source.return_value = None
    mock_repo.save_indexed_source.return_value = "doc-123"
    mock_repo_class.return_value = mock_repo

    mock_extractor = MagicMock()
    mock_extractor.extract_terms.return_value = [
        ExtractionCandidate(chunkId="0", text="PostgreSQL", label="TECHNOLOGY", startOffset=0, endOffset=10, confidence=0.99)
    ]
    mock_extractor_factory.return_value = mock_extractor

    mock_embedder = MagicMock()
    mock_embedder.create_embeddings.return_value = [[0.1]*1024]
    mock_embedding_factory.return_value = mock_embedder

    indexer = SourceIndexer(mock_session)
    result = await indexer.index_source(
        tenant_id="tenant-1",
        collection_id="proj-1",
        source_id="src-1",
        source_type="markdown",
        document_name="Test Doc",
        content="# PostgreSQL\n\nSome text.",
        content_uri=None,
        content_metadata={"foo": "bar"}
    )

    assert result["status"] == "indexed"
    assert result["documentId"] == "doc-123"
    assert result["chunkCount"] == 1
    assert result["termCount"] == 1
    assert result["chunkTermCount"] == 1

    # Check repository calls
    mock_repo.delete_document_by_source.assert_called_once_with("tenant-1", "proj-1", "src-1")
    mock_repo.save_indexed_source.assert_called_once()
    mock_repo.cleanup_orphan_terms.assert_called_once_with("tenant-1", "proj-1")
    mock_extractor.extract_terms.assert_called_once()
    _, kwargs = mock_extractor.extract_terms.call_args
    assert kwargs["labels"] == [
        "concept",
        "topic",
        "technology",
        "tool",
        "framework",
        "method",
        "process",
        "principle",
        "metric",
        "organization",
        "person",
        "location",
    ]
    assert kwargs["threshold"] == 0.5

    saved_chunks = mock_repo.save_indexed_source.call_args.args[1]
    assert saved_chunks[0]["embedding_model"] == "Qwen/Qwen3-Embedding-0.6B"
    assert saved_chunks[0]["embedding_dimensions"] == 1024


@patch('app.indexing.source_indexer.SourceRepository')
@patch('app.indexing.source_indexer.create_term_extractor')
@patch('app.indexing.source_indexer.create_embedding_runtime')
@pytest.mark.anyio
async def test_index_source_unchanged(mock_embedding_factory, mock_extractor_factory, mock_repo_class, mock_session):
    mock_repo = AsyncMock()
    # Mock returning an existing doc with the same hash
    existing_doc = MagicMock()
    # "Hello" sha256 is 185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969
    import hashlib
    content = "Hello"
    existing_doc.content_hash = hashlib.sha256(content.encode()).hexdigest()
    existing_doc.id = "doc-456"
    mock_repo.get_document_by_source.return_value = existing_doc
    mock_repo_class.return_value = mock_repo

    indexer = SourceIndexer(mock_session)
    result = await indexer.index_source(
        tenant_id="tenant-1",
        collection_id="proj-1",
        source_id="src-1",
        source_type="text",
        document_name="Hello Doc",
        content=content,
        content_uri=None,
        content_metadata={}
    )

    assert result["status"] == "unchanged"
    assert result["documentId"] == "doc-456"
    assert result["chunkCount"] == 0

    # Ensure no processing happened
    mock_repo.save_indexed_source.assert_not_called()
    mock_embedding_factory.return_value.create_embeddings.assert_not_called()
    mock_extractor_factory.return_value.extract_terms.assert_not_called()


@patch('app.indexing.source_indexer.SourceRepository')
@patch('app.indexing.source_indexer.create_term_extractor')
@patch('app.indexing.source_indexer.create_embedding_runtime')
@pytest.mark.anyio
async def test_index_source_uses_empty_tenant_for_global_terms(
    mock_embedding_factory,
    mock_extractor_factory,
    mock_repo_class,
    mock_session,
):
    mock_repo = AsyncMock()
    mock_repo.get_document_by_source.return_value = None
    mock_repo.save_indexed_source.return_value = "doc-789"
    mock_repo_class.return_value = mock_repo

    mock_extractor = MagicMock()
    mock_extractor.extract_terms.return_value = [
        ExtractionCandidate(chunkId="0", text="PostgreSQL", label="technology", startOffset=0, endOffset=10, confidence=0.99)
    ]
    mock_extractor_factory.return_value = mock_extractor

    mock_embedder = MagicMock()
    mock_embedder.create_embeddings.return_value = [[0.1] * 1024]
    mock_embedding_factory.return_value = mock_embedder

    indexer = SourceIndexer(mock_session)
    await indexer.index_source(
        tenant_id=None,
        collection_id="proj-1",
        source_id="src-1",
        source_type="text",
        document_name="Global Tenant Doc",
        content="PostgreSQL supports pgvector.",
        content_uri=None,
        content_metadata={},
    )

    document_data = mock_repo.save_indexed_source.call_args.args[0]
    terms_data = mock_repo.save_indexed_source.call_args.args[2]
    assert document_data["tenant_id"] == ""
    assert terms_data[0]["tenant_id"] == ""


@patch('app.indexing.source_indexer.SourceRepository')
@patch('app.indexing.source_indexer.create_term_extractor')
@patch('app.indexing.source_indexer.create_embedding_runtime')
@pytest.mark.anyio
async def test_index_source_fails_when_embedding_count_mismatches(
    mock_embedding_factory,
    mock_extractor_factory,
    mock_repo_class,
    mock_session,
):
    mock_repo = AsyncMock()
    mock_repo.get_document_by_source.return_value = None
    mock_repo_class.return_value = mock_repo

    mock_embedder = MagicMock()
    mock_embedder.create_embeddings.return_value = []
    mock_embedding_factory.return_value = mock_embedder

    indexer = SourceIndexer(mock_session)

    with pytest.raises(RuntimeError, match="embedding_count_mismatch"):
        await indexer.index_source(
            tenant_id="tenant-1",
            collection_id="proj-1",
            source_id="src-1",
            source_type="text",
            document_name="Bad Embedding Doc",
            content="This content should produce one chunk.",
            content_uri=None,
            content_metadata={},
        )

    mock_repo.delete_document_by_source.assert_not_called()
    mock_repo.save_indexed_source.assert_not_called()


@patch('app.indexing.source_indexer.SourceRepository')
@patch('app.indexing.source_indexer.create_term_extractor')
@patch('app.indexing.source_indexer.create_embedding_runtime')
@pytest.mark.anyio
async def test_index_source_uses_configured_embedding_dimensions(
    mock_embedding_factory,
    mock_extractor_factory,
    mock_repo_class,
    mock_session,
    monkeypatch,
):
    monkeypatch.setenv("EMBEDDING_DIMENSIONS", "3")
    monkeypatch.setenv("EMBEDDING_MODEL", "opaque-test-model")

    mock_repo = AsyncMock()
    mock_repo.get_document_by_source.return_value = None
    mock_repo.save_indexed_source.return_value = "doc-321"
    mock_repo_class.return_value = mock_repo

    mock_extractor = MagicMock()
    mock_extractor.extract_terms.return_value = []
    mock_extractor_factory.return_value = mock_extractor

    mock_embedder = MagicMock()
    mock_embedder.create_embeddings.return_value = [[0.1, 0.2, 0.3]]
    mock_embedding_factory.return_value = mock_embedder

    await SourceIndexer(mock_session).index_source(
        tenant_id="tenant-1",
        collection_id="proj-1",
        source_id="src-1",
        source_type="text",
        document_name="Three Dim Doc",
        content="Small dimensional embedding for test.",
        content_uri=None,
        content_metadata={},
    )

    saved_chunks = mock_repo.save_indexed_source.call_args.args[1]
    assert saved_chunks[0]["embedding_model"] == "opaque-test-model"
    assert saved_chunks[0]["embedding_dimensions"] == 3
