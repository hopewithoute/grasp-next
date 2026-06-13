from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.indexing.source_indexer import SourceIndexer
from app.storage.repositories import SourceRepository
from app.api.auth import verify_api_key
from app.storage.db import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class IndexSourceRequest(BaseModel):
    tenantId: Optional[str] = None
    collectionId: str
    sourceId: str
    sourceType: str
    documentName: str
    content: str
    contentUri: Optional[str] = None
    contentMetadata: Optional[Dict[str, Any]] = None

class IndexSourceResponse(BaseModel):
    status: str
    documentId: Optional[str] = None
    chunkCount: int = 0
    termCount: int = 0
    chunkTermCount: int = 0
    contentHash: Optional[str] = None

class DeleteSourceRequest(BaseModel):
    tenantId: Optional[str] = None
    collectionId: str
    sourceId: str

class DeleteSourceResponse(BaseModel):
    status: str
    deletedDocumentCount: int = 0

@router.post("/v1/sources/index", response_model=IndexSourceResponse)
async def index_source(
    request: IndexSourceRequest,
    _: None = Depends(verify_api_key),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        indexer = SourceIndexer(session)
        result = await indexer.index_source(
            tenant_id=request.tenantId,
            collection_id=request.collectionId,
            source_id=request.sourceId,
            source_type=request.sourceType,
            document_name=request.documentName,
            content=request.content,
            content_uri=request.contentUri,
            content_metadata=request.contentMetadata or {}
        )
        return IndexSourceResponse(**result)
    except Exception as e:
        logger.exception(f"Failed to index source {request.sourceId}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/v1/sources/delete", response_model=DeleteSourceResponse)
async def delete_source(
    request: DeleteSourceRequest,
    _: None = Depends(verify_api_key),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        repo = SourceRepository(session)
        deleted_count = await repo.delete_document_by_source(
            tenant_id=request.tenantId,
            collection_id=request.collectionId,
            source_id=request.sourceId,
        )
        await repo.cleanup_orphan_terms(request.tenantId, request.collectionId)
        await session.commit()
        return DeleteSourceResponse(status="deleted", deletedDocumentCount=deleted_count)
    except Exception as e:
        logger.exception(f"Failed to delete source {request.sourceId}")
        raise HTTPException(status_code=500, detail=str(e))
