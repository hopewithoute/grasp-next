import asyncio
import json
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, UploadFile, Request
from sse_starlette.sse import EventSourceResponse

from app.api.auth import verify_api_key
from app.models import IngestionRunRecord
from app.actions.ingest_action import IngestAction
from app.contracts import IngestSourceRequest, IngestSourceResponse
from app.oban_ext import get_oban_instance

router = APIRouter(prefix="/v1/ingest", tags=["ingest"])


@router.post("/source", response_model=IngestSourceResponse)
async def ingest_source(
    request: IngestSourceRequest,
    _: None = Depends(verify_api_key),
    action: IngestAction = Depends(),
):
    result = await action.ingest_source(
        request=request,
    )
    return IngestSourceResponse(**result)


@router.post("/pdf", response_model=IngestSourceResponse)
async def ingest_pdf(
    tenantId: str = Form(...),
    projectId: UUID = Form(...),
    externalSourceId: UUID = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    _: None = Depends(verify_api_key),
    action: IngestAction = Depends(),
):
    result = await action.ingest_pdf(
        tenantId=tenantId,
        projectId=projectId,
        externalSourceId=externalSourceId,
        title=title,
        file=file,
    )
    return IngestSourceResponse(**result)


@router.get("/runs/{run_id}", response_model=IngestionRunRecord)
async def get_ingestion_run(
    run_id: str,
    _: None = Depends(verify_api_key),
    action: IngestAction = Depends(),
):
    return await action.get_ingestion_run(run_id)


@router.get("/projects/{project_id}/runs", response_model=list[IngestionRunRecord])
async def list_runs_for_project(
    project_id: str,
    limit: int = 100,
    _: None = Depends(verify_api_key),
    action: IngestAction = Depends(),
):
    return await action.list_runs_for_project(project_id, limit)

@router.get("/projects/{project_id}/runs/events")
async def project_ingestion_events(
    request: Request,
    project_id: str,
    _: None = Depends(verify_api_key),
):
    oban = get_oban_instance()
    queue = asyncio.Queue()
    
    async def handler(channel: str, payload: dict):
        if payload.get("project_id") == project_id:
            await queue.put(payload)
            
    token = await oban._notifier.listen("ingestion_updates", handler)
    
    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield {
                        "data": json.dumps(payload)
                    }
                except asyncio.TimeoutError:
                    continue
        finally:
            await oban._notifier.unlisten(token)
            
    return EventSourceResponse(event_generator())
