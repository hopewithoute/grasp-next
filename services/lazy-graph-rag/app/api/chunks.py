from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, UUID4
from typing import List, Optional, Dict, Any
from app.storage.db import get_db_session
from app.api.auth import verify_api_key
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, String
from app.storage.models import Chunk, Document
from sqlalchemy.orm import selectinload

router = APIRouter()
from pydantic import BaseModel, UUID4, Field

class GetChunksRequest(BaseModel):
    chunkIds: List[UUID4] = Field(..., max_length=5000)
    tenantId: Optional[str] = None

class GetChunksResponse(BaseModel):
    chunks: List[Dict[str, Any]]

@router.post("/v1/chunks/get", response_model=GetChunksResponse)
async def get_chunks(
    request: GetChunksRequest,
    _: None = Depends(verify_api_key),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        # Convert string UUIDs properly or assume they are stored as UUIDs.
        stmt = (
            select(Chunk, Document.document_name, Document.source_type)
            .join(Document, Chunk.document_id == Document.id)
            .where(Chunk.id.in_(request.chunkIds))
        )
        if request.tenantId:
            stmt = stmt.where(Document.tenant_id == request.tenantId)
            
        result = await session.execute(stmt)
        rows = result.all()
        
        chunks = [
            {
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "document_name": doc_name,
                "source_type": source_type,
                "content": chunk.content,
                "start_offset": chunk.start_offset,
                "end_offset": chunk.end_offset,
                "chunk_index": chunk.chunk_index
            }
            for chunk, doc_name, source_type in rows
        ]
            
        return GetChunksResponse(chunks=chunks)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
