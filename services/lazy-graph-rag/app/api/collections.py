from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.storage.repositories import SourceRepository
from app.api.auth import verify_api_key
from app.storage.db import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class DeleteCollectionRequest(BaseModel):
    tenantId: Optional[str] = None
    collectionId: str


class DeleteCollectionResponse(BaseModel):
    status: str
    deletedDocumentCount: int = 0


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
