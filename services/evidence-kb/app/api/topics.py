from fastapi import APIRouter, Depends, Query
from app.api.auth import verify_api_key
from app.models import ConceptGraphResponse, TopicRecord
from app.actions.topics_action import TopicsAction

router = APIRouter(prefix="/v1/projects", tags=["topics"])


@router.get("/{project_id}/topics", response_model=list[TopicRecord])
async def list_topics(
    project_id: str,
    tenant_id: str = Query(..., alias="tenantId"),
    _: None = Depends(verify_api_key),
    action: TopicsAction = Depends(),
):
    """List all topics for a project."""
    return await action.list_topics(tenant_id=tenant_id, project_id=project_id)


@router.get("/{project_id}/concept-graph", response_model=ConceptGraphResponse)
async def get_concept_graph(
    project_id: str,
    tenant_id: str = Query(..., alias="tenantId"),
    min_weight: int = Query(2, description="Minimum edge weight (co-occurrences) to include"),
    _: None = Depends(verify_api_key),
    action: TopicsAction = Depends(),
):
    """Return the concept graph nodes (topics) and edges (co-occurrences)."""
    return await action.get_concept_graph(tenant_id=tenant_id, project_id=project_id, min_weight=min_weight)
