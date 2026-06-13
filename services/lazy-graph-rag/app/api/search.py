from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.retrieval.hybrid import HybridSearcher
from app.api.auth import verify_api_key
from app.storage.db import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

from pydantic import BaseModel, Field

class SearchRequest(BaseModel):
    tenantId: Optional[str] = None
    collectionId: str
    query: str
    topK: int = Field(default=8, le=1000)

class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    trace: Dict[str, Any]

@router.post("/v1/search", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    _: None = Depends(verify_api_key),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        searcher = HybridSearcher(session)
        result = await searcher.search(
            tenant_id=request.tenantId,
            collection_id=request.collectionId,
            query=request.query,
            top_k=request.topK
        )
        return SearchResponse(**result)
    except Exception as e:
        logger.exception(f"Search failed for collection {request.collectionId}")
        raise HTTPException(status_code=500, detail=str(e))
