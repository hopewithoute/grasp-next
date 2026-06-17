from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.storage.repositories import SourceRepository
from app.api.auth import verify_api_key
from app.storage.db import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.storage.models import Document
from app.storage.tenant import normalize_tenant_id
import logging
from app.indexing.cooccurrence_builder import CooccurrenceBuilder
from app.indexing.community_builder import CommunityBuilder

router = APIRouter()
logger = logging.getLogger(__name__)


class DeleteCollectionRequest(BaseModel):
    tenantId: Optional[str] = None
    collectionId: str


class DeleteCollectionResponse(BaseModel):
    status: str
    deletedDocumentCount: int = 0

class BuildGraphRequest(BaseModel):
    collectionId: str

class BuildGraphResponse(BaseModel):
    status: str
    cooccurrenceCount: int
    communityCount: int

class CollectionStatusResponse(BaseModel):
    collectionId: str
    documentCount: int


@router.post("/v1/collections/delete", response_model=DeleteCollectionResponse)
async def delete_collection(
    request: DeleteCollectionRequest,
    _: None = Depends(verify_api_key),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        repo = SourceRepository(session)
        deleted_count = await repo.delete_collection(
            tenant_id=request.tenantId,
            collection_id=request.collectionId,
        )
        await session.commit()
        return DeleteCollectionResponse(status="deleted", deletedDocumentCount=deleted_count)
    except Exception as e:
        logger.exception(f"Failed to delete collection {request.collectionId}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/v1/collections/build-graph", response_model=BuildGraphResponse)
async def build_graph(
    request: BuildGraphRequest,
    _: None = Depends(verify_api_key),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        cooc_builder = CooccurrenceBuilder(session)
        cooc_count = await cooc_builder.build_for_collection(request.collectionId)
        
        comm_builder = CommunityBuilder(session)
        comm_count = await comm_builder.build_for_collection(request.collectionId)
        
        await session.commit()
        return BuildGraphResponse(status="success", cooccurrenceCount=cooc_count, communityCount=comm_count)
    except Exception as e:
        logger.exception(f"Failed to build graph for collection {request.collectionId}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/v1/collections/{collection_id}/status", response_model=CollectionStatusResponse)
async def get_collection_status(
    collection_id: str,
    tenant_id: Optional[str] = None,
    _: None = Depends(verify_api_key),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        normalized_tenant = normalize_tenant_id(tenant_id)
        stmt = select(func.count(Document.id)).where(
            Document.collection_id == collection_id,
            Document.tenant_id == normalized_tenant
        )
        result = await session.execute(stmt)
        count = result.scalar_one_or_none() or 0
        
        return CollectionStatusResponse(
            collectionId=collection_id,
            documentCount=count
        )
    except Exception as e:
        logger.exception(f"Failed to get status for collection {collection_id}")
        raise HTTPException(status_code=500, detail=str(e))
