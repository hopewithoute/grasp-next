from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.storage.graph_repository import GraphRepository
from app.api.auth import verify_api_key
from app.storage.db import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class GraphRequest(BaseModel):
    tenantId: Optional[str] = None
    collectionId: str
    limit: int = Field(default=100, le=5000)

class GraphResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

@router.post("/v1/graph/local", response_model=GraphResponse)
async def get_graph(
    request: GraphRequest,
    _: None = Depends(verify_api_key),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        repo = GraphRepository(session)
        result = await repo.get_local_graph(
            tenant_id=request.tenantId,
            collection_id=request.collectionId,
            limit=request.limit
        )
        return GraphResponse(**result)
    except Exception as e:
        logger.exception(f"Failed to fetch graph for collection {request.collectionId}")
        raise HTTPException(status_code=500, detail=str(e))
