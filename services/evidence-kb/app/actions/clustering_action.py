import logging
import uuid
import numpy as np
from uuid import UUID
from typing import List, Tuple
from collections import defaultdict

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import kneighbors_graph
from sknetwork.clustering import Louvain

from app.storage.db import get_sessionmaker
from sqlalchemy import select, delete
from app.storage.models import KbPassage, Topic, TopicPassage
from app.settings import get_settings

logger = logging.getLogger(__name__)


async def cluster_project_topics(tenant_id: str, project_id: str) -> None:
    """
    Cluster all passages in a project using KNN + Louvain to form Topics.
    Extract TF-IDF keywords as names and compute centroids as topic embeddings.
    Replaces existing topics for the project.
    """
    logger.info(f"Starting topic clustering for project {project_id}")
    sessionmaker = get_sessionmaker()
    settings = get_settings()

    async with sessionmaker() as session:
        # 1. Fetch all passages for the project
        stmt = select(KbPassage.id, KbPassage.text, KbPassage.embedding).where(
            KbPassage.tenant_id == tenant_id,
            KbPassage.project_id == UUID(str(project_id)),
            KbPassage.embedding.is_not(None)
        )
        result = await session.execute(stmt)
        rows = result.all()

        if not rows:
            logger.warning(f"No passages with embeddings found for project {project_id}. Skipping clustering.")
            return

        passage_ids = [str(r.id) for r in rows]
        texts = [r.text for r in rows]
        embeddings = np.array([r.embedding for r in rows])
        
        n_samples = len(embeddings)

        if n_samples < 2:
            logger.warning(f"Only {n_samples} passages found. Skipping clustering.")
            return

        # 2. Build KNN Graph
        # We use cosine similarity (1 - cosine distance)
        # kneighbors_graph uses Euclidean distance by default. For normalized vectors, Euclidean is proportional to Cosine.
        # Let's normalize the embeddings first to be safe.
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1
        embeddings_normalized = embeddings / norms

        n_neighbors = min(15, n_samples - 1)
        # We use mode='distance' and then convert to similarity
        adjacency_matrix = kneighbors_graph(
            embeddings_normalized,
            n_neighbors=n_neighbors,
            mode='distance',
            metric='euclidean',
            include_self=False
        )
        
        # Convert distance to similarity for Louvain
        # For normalized vectors, euclidean_distance^2 = 2 - 2*cosine_similarity
        # similarity = 1 - (distance^2 / 2)
        adjacency_matrix.data = 1.0 - (adjacency_matrix.data ** 2) / 2.0
        
        # Remove negative similarities just in case, though they shouldn't occur often
        adjacency_matrix.data[adjacency_matrix.data < 0] = 0

        # 3. Detect Communities using Louvain
        louvain = Louvain()
        labels = louvain.fit_predict(adjacency_matrix)

        # 4. Group passages by community
        clusters = defaultdict(list)
        for idx, label in enumerate(labels):
            clusters[label].append(idx)
            
        logger.info(f"Found {len(clusters)} topic clusters.")

        # 5. Compute centroids and extract keywords
        new_topics = []
        new_topic_passages = []

        for cluster_id, indices in clusters.items():
            cluster_embeddings = embeddings[indices]
            centroid = np.mean(cluster_embeddings, axis=0).tolist()
            
            cluster_texts = [texts[i] for i in indices]
            
            # Use TF-IDF to find top 2 keywords
            try:
                vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
                tfidf_matrix = vectorizer.fit_transform(cluster_texts)
                # Sum tfidf scores across all passages in this cluster
                sum_tfidf = tfidf_matrix.sum(axis=0)
                words_freq = [(word, sum_tfidf[0, idx]) for word, idx in vectorizer.vocabulary_.items()]
                words_freq = sorted(words_freq, key=lambda x: x[1], reverse=True)
                
                # Take top 2 words
                top_words = [w[0].capitalize() for w in words_freq[:2]]
                topic_name = " ".join(top_words) if top_words else "Unknown Topic"
            except Exception as e:
                logger.warning(f"TF-IDF failed for cluster: {e}")
                topic_name = "Concept Group"

            topic_record = Topic(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                project_id=UUID(str(project_id)),
                name=topic_name,
                description=f"Auto-generated cluster of {len(indices)} passages.",
                is_user_defined=False,
                embedding=centroid
            )
            new_topics.append(topic_record)
            
            for i in indices:
                new_topic_passages.append(TopicPassage(
                    topic_id=topic_record.id,
                    passage_id=UUID(passage_ids[i]),
                    relevance_score=1.0
                ))

        # 6. Save to DB
        # First, delete old auto-generated topics (is_user_defined=False) for this project
        await session.execute(
            delete(Topic).where(
                Topic.tenant_id == tenant_id,
                Topic.project_id == UUID(str(project_id)),
                Topic.is_user_defined == False
            )
        )
        
        session.add_all(new_topics)
        session.add_all(new_topic_passages)
        await session.commit()
        logger.info(f"Successfully saved {len(new_topics)} topics and {len(new_topic_passages)} topic passages.")
