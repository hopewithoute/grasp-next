from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.api.auth import verify_api_key
from app.storage.db import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from app.query.orchestrator import QueryOrchestrator
from app.query.models import Citation, RetrievedContext

router = APIRouter()
logger = logging.getLogger(__name__)

class QueryRequest(BaseModel):
    tenantId: Optional[str] = None
    collectionId: str
    query: str
    topK: int = Field(default=8, le=1000)
    budgetPreset: str = Field(default="lite", description="lite, balanced, or deep")
    retrievalMode: str = Field(default="hybrid", description="hybrid or graph_lite")

class Trace(BaseModel):
    budgetPreset: str
    steps: List[Dict[str, Any]]

class QueryResponse(BaseModel):
    answer: str
    contexts: List[RetrievedContext]
    citations: List[Citation]
    trace: Trace

@router.post("/v1/query", response_model=QueryResponse)
async def query(
    request: QueryRequest,
    _: None = Depends(verify_api_key),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        orchestrator = QueryOrchestrator(session)
        result = await orchestrator.execute_query(
            tenant_id=request.tenantId,
            collection_id=request.collectionId,
            query=request.query,
            top_k=request.topK,
            budget_preset=request.budgetPreset,
            retrieval_mode=request.retrievalMode
        )
        await session.commit()
        return QueryResponse(**result)
    except ValueError as e:
        logger.warning(f"Invalid query request for collection {request.collectionId}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Query failed for collection {request.collectionId}")
        raise HTTPException(status_code=500, detail=str(e))
