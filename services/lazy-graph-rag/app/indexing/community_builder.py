import uuid
from typing import Dict, List, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, insert
import networkx as nx

from app.storage.models import (
    TermCooccurrence,
    Community,
    TermCommunityMembership
)

class CommunityBuilder:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def build_for_collection(self, collection_id: str):
        """
        Rebuild hierarchical communities using Louvain community detection.
        """
        await self._clear_existing_communities(collection_id)
        
        edges = await self._fetch_cooccurrences(collection_id)
        if not edges:
            return 0
            
        graph = self._build_graph(edges)
        partitions = list(nx.algorithms.community.louvain_partitions(graph, weight='weight'))
        
        communities_data, memberships_data = self._process_partitions(collection_id, partitions)
        await self._save_to_db(communities_data, memberships_data)
        
        return len(communities_data)

    async def _clear_existing_communities(self, collection_id: str):
        await self.session.execute(
            delete(Community).where(Community.collection_id == collection_id)
        )

    async def _fetch_cooccurrences(self, collection_id: str) -> List[TermCooccurrence]:
        stmt = select(TermCooccurrence).where(TermCooccurrence.collection_id == collection_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    def _build_graph(self, edges: List[TermCooccurrence]) -> nx.Graph:
        G = nx.Graph()
        for edge in edges:
            G.add_edge(edge.term_a_id, edge.term_b_id, weight=edge.weight)
        return G

    def _process_partitions(self, collection_id: str, partitions: List[Set]) -> tuple[List[Dict], List[Dict]]:
        communities_data = []
        memberships_data = []
        level_term_to_community = {}
        parent_updates = {}
        
        for level, partition in enumerate(partitions):
            for comm_nodes in partition:
                comm_id = uuid.uuid4()
                communities_data.append({
                    "id": comm_id,
                    "collection_id": collection_id,
                    "level": level,
                    "parent_community_id": None,
                    "algorithm": "louvain",
                    "algorithm_version": "networkx-1.0"
                })
                
                for term_id in comm_nodes:
                    memberships_data.append({
                        "community_id": comm_id,
                        "term_id": term_id,
                        "membership_score": 1.0
                    })
                    
                    level_term_to_community[(level, term_id)] = comm_id
                    
                    if level > 0:
                        prev_comm_id = level_term_to_community[(level - 1, term_id)]
                        parent_updates[prev_comm_id] = comm_id

        for c in communities_data:
            if c["id"] in parent_updates:
                c["parent_community_id"] = parent_updates[c["id"]]
                
        return communities_data, memberships_data

    async def _save_to_db(self, communities_data: List[Dict], memberships_data: List[Dict]):
        communities_data.sort(key=lambda x: x["level"], reverse=True)
        if communities_data:
            await self.session.execute(insert(Community), communities_data)
        if memberships_data:
            await self.session.execute(insert(TermCommunityMembership), memberships_data)
