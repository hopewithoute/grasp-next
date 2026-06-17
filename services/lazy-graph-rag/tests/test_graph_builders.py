import pytest
import uuid
from unittest.mock import AsyncMock, patch, MagicMock

from app.indexing.cooccurrence_builder import CooccurrenceBuilder
from app.indexing.community_builder import CommunityBuilder

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture
def mock_session():
    return AsyncMock()

@pytest.mark.anyio
async def test_cooccurrence_builder(mock_session):
    builder = CooccurrenceBuilder(mock_session)
    
    # Mock the result of session.execute for the chunk_terms query
    chunk_id = uuid.uuid4()
    term_1 = uuid.uuid4()
    term_2 = uuid.uuid4()
    
    mock_row_1 = MagicMock()
    mock_row_1.chunk_id = chunk_id
    mock_row_1.term_id = term_1
    
    mock_row_2 = MagicMock()
    mock_row_2.chunk_id = chunk_id
    mock_row_2.term_id = term_2
    
    # Session execute returns a mock result
    # We have 2 calls to execute: delete, and select
    mock_result = MagicMock()
    mock_result.__iter__.return_value = [mock_row_1, mock_row_2]
    
    # Setup session.execute to return the mock_result for the select statement
    # For delete, it doesn't matter much.
    mock_session.execute.return_value = mock_result
    
    count = await builder.build_for_collection("col-1")
    
    assert count == 1
    # Check that insert was called
    # session.execute is called 4 times: delete, select, insert(TermCooccurrence), insert(TermCooccurrenceChunk)
    assert mock_session.execute.call_count == 4
    

@pytest.mark.anyio
async def test_community_builder(mock_session):
    builder = CommunityBuilder(mock_session)
    
    term_1 = uuid.uuid4()
    term_2 = uuid.uuid4()
    
    mock_edge = MagicMock()
    mock_edge.term_a_id = term_1
    mock_edge.term_b_id = term_2
    mock_edge.weight = 1.0
    
    mock_result = MagicMock()
    mock_result.scalars().all.return_value = [mock_edge]
    
    mock_session.execute.return_value = mock_result
    
    count = await builder.build_for_collection("col-1")
    
    # With 1 edge connecting 2 nodes, Louvain should find 1 community at level 0
    assert count == 1
    
    # session.execute called for delete, select, insert(Community), insert(TermCommunityMembership)
    assert mock_session.execute.call_count == 4
