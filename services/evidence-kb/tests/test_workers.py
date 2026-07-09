import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.workers import EvidenceIngestionWorker
import oban

@pytest.mark.anyio
async def test_evidence_ingestion_worker_enqueue():
    # Arrange
    job_args = {
        "run_id": "test-run-id",
        "source_id": "test-source-id",
        "source_type": "pdf",
        "project_id": "test-project-id",
    }
    
    mock_conn = AsyncMock()
    
    # Act
    # oban.Worker.enqueue is a classmethod that inserts a job into the DB
    mock_oban = MagicMock()
    mock_oban.enqueue = AsyncMock()

    with patch("oban.Oban.get_instance", return_value=mock_oban):
        await EvidenceIngestionWorker.enqueue(job_args, conn=mock_conn)
        
        # enqueue on the mock_oban should be called, but wait, 
        # EvidenceIngestionWorker.enqueue transforms it into `Job` and passes to `mock_oban.enqueue`
        mock_oban.enqueue.assert_called_once()
        
        # Verify job args
        called_job = mock_oban.enqueue.call_args[0][0]
        assert called_job.args == job_args
        assert mock_oban.enqueue.call_args[1]["conn"] == mock_conn

