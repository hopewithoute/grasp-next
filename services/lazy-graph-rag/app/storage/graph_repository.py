from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import bindparam, text
import logging
from app.storage.tenant import normalize_tenant_id

logger = logging.getLogger(__name__)

class GraphRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_local_graph(self, tenant_id: Optional[str], collection_id: str, limit: int = 100) -> Dict[str, Any]:
        normalized_tenant_id = normalize_tenant_id(tenant_id)
        # 1. Fetch Top Terms (Nodes) based on occurrence frequency
        nodes_query = text(f"""
            SELECT 
                t.id, 
                t.text, 
                t.label, 
                t.status,
                COUNT(ct.chunk_id) as frequency
            FROM lgs.terms t
            JOIN lgs.chunk_terms ct ON t.id = ct.term_id
            WHERE t.collection_id = :collection_id
            AND t.tenant_id = :tenant_id
            GROUP BY t.id, t.text, t.label, t.status
            ORDER BY frequency DESC
            LIMIT :limit
        """)

        node_params = {
            "collection_id": collection_id,
            "limit": limit,
            "tenant_id": normalized_tenant_id,
        }

        nodes_result = await self.session.execute(nodes_query, node_params)
        nodes_rows = list(nodes_result)
        node_ids = {str(row.id) for row in nodes_rows}
        
        nodes = [
            {
                "id": str(row.id),
                "data": {
                    "label": row.text,
                    "type": row.label,
                    "status": row.status,
                    "frequency": row.frequency
                },
                "position": {"x": 0, "y": 0}  # Required by React Flow
            }
            for row in nodes_rows
        ]

        if not node_ids:
            return {"nodes": [], "edges": []}

        # 2. Fetch Co-occurrences (Edges) only among the top nodes
        edges_query = text("""
            SELECT 
                ct1.term_id AS source_id,
                ct2.term_id AS target_id,
                COUNT(DISTINCT ct1.chunk_id) AS weight
            FROM lgs.chunk_terms ct1
            JOIN lgs.chunk_terms ct2 ON ct1.chunk_id = ct2.chunk_id AND ct1.term_id < ct2.term_id
            WHERE ct1.term_id IN :node_ids AND ct2.term_id IN :node_ids
            GROUP BY ct1.term_id, ct2.term_id
            HAVING COUNT(DISTINCT ct1.chunk_id) > 0
        """).bindparams(bindparam("node_ids", expanding=True))
        
        edges_result = await self.session.execute(edges_query, {
            "node_ids": tuple(node_ids)
        })
        
        edges = [
            {
                "id": f"{row.source_id}_{row.target_id}",
                "source": str(row.source_id),
                "target": str(row.target_id),
                "data": {
                    "weight": row.weight
                }
            }
            for row in edges_result
        ]

        return {
            "nodes": nodes,
            "edges": edges
        }
