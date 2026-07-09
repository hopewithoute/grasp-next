from time import monotonic
from uuid import UUID, uuid4
from sqlalchemy import delete, select, insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import (
    CurationStatus,
    IngestionRunRecord,
    IngestionStatus,
    Location,
    PassageRecord,
    RetrievedPassage,
    RetrievalRunRecord,
    SourceRecord,
)
from app.retrieval.hybrid import rrf_fuse
from app.settings import get_settings
from app.storage.models import (
    KbIngestionRun,
    KbPassage,
    KbRetrievedPassage,
    KbRetrievalRun,
    KbSource,
    Topic,
    TopicPassage,
)


class SqlEvidenceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert_source(
        self,
        tenant_id: str,
        project_id: str,
        external_source_id: str,
        title: str,
        source_type: str,
        metadata: dict,
    ) -> SourceRecord:
        stmt = select(KbSource).where(
            KbSource.tenant_id == tenant_id,
            KbSource.project_id == UUID(str(project_id)),
            KbSource.external_source_id == UUID(str(external_source_id)),
        )
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.title = title  # type: ignore
            existing.source_type = source_type  # type: ignore
            existing.metadata_ = metadata  # type: ignore
            await self.session.commit()
            return SourceRecord.model_validate(existing)

        source = KbSource(
            id=uuid4(),
            tenant_id=tenant_id,
            project_id=UUID(str(project_id)),
            external_source_id=UUID(str(external_source_id)),
            title=title,
            source_type=source_type,
            metadata_=metadata,
        )
        self.session.add(source)
        await self.session.commit()
        await self.session.refresh(source)
        return SourceRecord.model_validate(source)

    async def delete_source_by_external_id(
        self, tenant_id: str, external_source_id: str, project_id: str | None = None
    ) -> bool:
        conditions = [
            KbSource.tenant_id == tenant_id,
            KbSource.external_source_id == UUID(str(external_source_id)),
        ]
        if project_id:
            conditions.append(KbSource.project_id == UUID(str(project_id)))

        stmt = delete(KbSource).where(*conditions)
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0  # type: ignore

    async def get_source_by_external_id(
        self, tenant_id: str, external_source_id: str, project_id: str | None = None
    ) -> SourceRecord | None:
        conditions = [
            KbSource.tenant_id == tenant_id,
            KbSource.external_source_id == UUID(str(external_source_id)),
        ]
        if project_id:
            conditions.append(KbSource.project_id == UUID(str(project_id)))

        stmt = select(KbSource).where(*conditions)
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing:
            return SourceRecord.model_validate(existing)
        return None

    async def get_source(self, source_id: str) -> SourceRecord | None:
        stmt = select(KbSource).where(KbSource.id == UUID(str(source_id)))
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing:
            return SourceRecord.model_validate(existing)
        return None

    async def delete_project(self, tenant_id: str, project_id: str) -> bool:
        stmt = delete(KbSource).where(
            KbSource.tenant_id == tenant_id,
            KbSource.project_id == UUID(str(project_id)),
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0  # type: ignore

    async def create_run(self, tenant_id: str, project_id: str, source_id: str) -> IngestionRunRecord:
        run = KbIngestionRun(
            id=uuid4(),
            tenant_id=tenant_id,
            project_id=UUID(str(project_id)),
            source_id=UUID(str(source_id)),
            status=IngestionStatus.PROCESSING.value,
        )
        self.session.add(run)
        await self.session.commit()
        await self.session.refresh(run)
        return IngestionRunRecord.model_validate(run)

    async def list_runs_for_project(self, project_id: str, limit: int = 100) -> list[IngestionRunRecord]:
        from sqlalchemy import desc
        stmt = (
            select(KbIngestionRun, KbSource.external_source_id)
            .join(KbSource, KbIngestionRun.source_id == KbSource.id)
            .where(KbIngestionRun.project_id == UUID(str(project_id)))
            .order_by(desc(KbIngestionRun.created_at))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        
        records = []
        for run, external_source_id in result.all():
            rec_dict = {
                "id": run.id,
                "tenant_id": run.tenant_id,
                "project_id": run.project_id,
                "source_id": run.source_id,
                "external_source_id": external_source_id,
                "status": run.status,
                "failure_reason": run.failure_reason,
                "stats": run.stats,
                "started_at": run.started_at,
                "completed_at": run.completed_at,
                "created_at": run.created_at,
                "updated_at": run.updated_at,
            }
            records.append(IngestionRunRecord(**rec_dict))
        return records

    async def replace_source_passages(
        self,
        source: SourceRecord,
        chunks: list[tuple[str, str, Location, int, int, float, list[str]]],
        embeddings: list[list[float]] | None = None,
    ) -> list[dict]:
        await self.session.execute(delete(KbPassage).where(KbPassage.source_id == UUID(str(source.id))))

        if not chunks:
            await self.session.commit()
            return []

        records = []
        for i, (block_id, text, location, order, tokens, quality_score, warnings) in enumerate(chunks):
            record = {
                "id": uuid4(),
                "tenant_id": source.tenant_id,
                "project_id": UUID(str(source.project_id)),
                "source_id": UUID(str(source.id)),
                "block_id": block_id,
                "text": text,
                "kind": "text",
                "location": location.model_dump(exclude_none=True),
                "order": order,
                "token_count": tokens,
                "quality_score": quality_score,
                "quality_warnings": warnings,
            }
            if embeddings and i < len(embeddings):
                record["embedding"] = embeddings[i]
            records.append(record)

        if records:
            batch_size = 1000
            for i in range(0, len(records), batch_size):
                await self.session.execute(insert(KbPassage), records[i : i + batch_size])
            await self.session.commit()

        return records

    async def replace_source_topics(
        self,
        source: SourceRecord,
        passage_topics: list[tuple[UUID, str]],  # (passage_id, topic_name)
    ) -> None:
        """
        Naive topic extraction mapping.
        Deletes existing auto-defined topics that are no longer used.
        """
        # First, ensure the topics exist.
        topic_names = set(topic_name for _, topic_name in passage_topics)

        # Get existing topics for this project
        stmt = select(Topic).where(Topic.project_id == UUID(str(source.project_id)), Topic.name.in_(list(topic_names)))
        existing_topics_res = await self.session.execute(stmt)
        existing_topics = {str(t.name): t for t in existing_topics_res.scalars()}

        topic_id_map = {}
        for name in topic_names:
            if name in existing_topics:
                topic_id_map[name] = existing_topics[name].id
            else:
                new_id = uuid4()
                new_topic = Topic(
                    id=new_id,
                    tenant_id=source.tenant_id,
                    project_id=UUID(str(source.project_id)),
                    name=name,
                    description=f"Auto-extracted concept: {name}",
                    is_user_defined=False,
                )
                self.session.add(new_topic)
                topic_id_map[name] = new_id

        await self.session.flush()

        # Find all passage IDs for this source
        stmt_passages = select(KbPassage.id).where(KbPassage.source_id == UUID(str(source.id)))
        source_passage_ids = (await self.session.execute(stmt_passages)).scalars().all()

        if source_passage_ids:
            # Delete existing topic_passages for passages belonging to this source
            await self.session.execute(delete(TopicPassage).where(TopicPassage.passage_id.in_(source_passage_ids)))

        # Insert new topic_passages
        if passage_topics:
            tp_records = []
            for passage_id, name in passage_topics:
                tp_records.append(
                    {
                        "topic_id": topic_id_map[name],
                        "passage_id": passage_id,
                        "relevance_score": 1.0,
                    }
                )
            if tp_records:
                await self.session.execute(insert(TopicPassage), tp_records)

        await self.session.commit()

    async def complete_run(self, run_id: str, stats: dict) -> IngestionRunRecord:
        run = await self.session.get(KbIngestionRun, UUID(str(run_id)))
        if run is None:
            raise KeyError(run_id)
        run.status = IngestionStatus.COMPLETED.value  # type: ignore
        run.stats = stats  # type: ignore
        await self.session.commit()
        await self.session.refresh(run)
        return IngestionRunRecord.model_validate(run)

    async def fail_run(self, run_id: str, reason: str) -> IngestionRunRecord:
        try:
            await self.session.rollback()
        except Exception:
            pass

        run = await self.session.get(KbIngestionRun, UUID(str(run_id)))
        if run is None:
            raise KeyError(run_id)
        run.status = IngestionStatus.FAILED.value  # type: ignore
        run.failure_reason = reason[:2000] if reason else "Unknown error"  # type: ignore
        await self.session.commit()
        await self.session.refresh(run)
        return IngestionRunRecord.model_validate(run)

    async def list_project_sources(
        self, tenant_id: str, project_id: str, skip: int = 0, limit: int = 1000
    ) -> list[SourceRecord]:
        stmt = (
            select(KbSource)
            .where(
                KbSource.tenant_id == tenant_id,
                KbSource.project_id == UUID(str(project_id)),
            )
            .order_by(KbSource.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [SourceRecord.model_validate(source) for source in result.scalars().all()]

    async def find_stale_sources(
        self,
        tenant_id: str,
        project_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> list[SourceRecord]:
        """Return sources that need attention: not certified, disabled retrieval, or have warnings."""
        from sqlalchemy import func, or_

        stmt = (
            select(KbSource)
            .where(
                KbSource.tenant_id == tenant_id,
                KbSource.project_id == UUID(str(project_id)),
                or_(
                    KbSource.status != "certified",
                    KbSource.retrieval_enabled == False,  # noqa: E712
                    func.jsonb_array_length(KbSource.quality_warnings) > 0,
                ),
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [SourceRecord.model_validate(s) for s in result.scalars().all()]

    async def list_source_passages(
        self,
        source_id: str,
        query: str | None = None,
        status: str | None = None,
        retrieval_enabled: bool | None = None,
        sort_field: str = "order",
        sort_direction: str = "asc",
        skip: int = 0,
        limit: int = 1000,
    ) -> tuple[list[PassageRecord], int]:
        from sqlalchemy import func

        stmt = (
            select(KbPassage)
            .join(KbSource, KbPassage.source_id == KbSource.id)
            .where(KbSource.external_source_id == str(source_id))
        )

        if query:
            stmt = stmt.where(KbPassage.text.ilike(f"%{query}%"))
        if status:
            stmt = stmt.where(KbPassage.status == status)
        if retrieval_enabled is not None:
            stmt = stmt.where(KbPassage.retrieval_enabled == retrieval_enabled)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()

        sort_map = {
            "quality_score": KbPassage.quality_score,
            "token_count": KbPassage.token_count,
            "status": KbPassage.status,
            "order": KbPassage.order,
        }
        order_col = sort_map.get(sort_field, KbPassage.order)
        sort_func = order_col.desc if sort_direction.lower() == "desc" else order_col.asc
        stmt = stmt.order_by(sort_func().nullslast())

        stmt = stmt.offset(skip).limit(limit)

        result = await self.session.execute(stmt)
        items = [PassageRecord.model_validate(passage) for passage in result.scalars().all()]
        return items, total

    async def get_passage(self, passage_id: str) -> PassageRecord | None:
        passage = await self.session.get(KbPassage, UUID(str(passage_id)))
        return PassageRecord.model_validate(passage) if passage else None

    async def get_surrounding_passages(self, passage_id: str, before: int = 1, after: int = 1) -> list[PassageRecord]:
        passage = await self.session.get(KbPassage, UUID(str(passage_id)))
        if not passage:
            return []

        stmt = (
            select(KbPassage)
            .where(
                KbPassage.source_id == passage.source_id,
                KbPassage.order >= passage.order - before,
                KbPassage.order <= passage.order + after,
                KbPassage.id != passage.id,
            )
            .order_by(KbPassage.order)
        )
        result = await self.session.execute(stmt)
        return [PassageRecord.model_validate(p) for p in result.scalars().all()]

    async def find_weak_passages(
        self,
        tenant_id: str,
        project_id: str,
        min_quality_score: float = 0.5,
        skip: int = 0,
        limit: int = 50,
    ) -> list[PassageRecord]:
        """Return passages that need attention: low quality, warnings, disabled retrieval, or rejected."""
        from sqlalchemy import or_

        stmt = (
            select(KbPassage)
            .where(
                KbPassage.tenant_id == tenant_id,
                KbPassage.project_id == UUID(str(project_id)),
                or_(
                    KbPassage.quality_score < min_quality_score,
                    KbPassage.status == "rejected",
                    KbPassage.retrieval_enabled == False,  # noqa: E712
                ),
            )
            .order_by(KbPassage.quality_score)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [PassageRecord.model_validate(p) for p in result.scalars().all()]

    async def get_run(self, run_id: str) -> IngestionRunRecord | None:
        run = await self.session.get(KbIngestionRun, UUID(str(run_id)))
        return IngestionRunRecord.model_validate(run) if run else None

    async def retrieve(
        self,
        tenant_id: str,
        project_id: str,
        query: str,
        mode: str,
        top_k: int | None,
        filters: dict,
        query_embedding: list[float] | None = None,
    ) -> RetrievalRunRecord:
        settings = get_settings()
        started = monotonic()
        limit = top_k or settings.DEFAULT_TOP_K
        bm25_hits: list[tuple[PassageRecord, float]] = []
        vector_hits: list[tuple[PassageRecord, float]] = []

        bm25_coro = None
        vector_coro = None

        if mode in ("bm25_only", "hybrid"):
            bm25_limit = limit * 4 if mode == "hybrid" else limit
            bm25_coro = self._pg_bm25_search(tenant_id, project_id, query, bm25_limit, filters)

        if mode in ("vector_only", "hybrid") and query_embedding is not None:
            vector_limit = limit * 4 if mode == "hybrid" else limit
            vector_coro = self._pg_vector_search(tenant_id, project_id, query_embedding, vector_limit, filters)

        if bm25_coro and vector_coro:
            bm25_hits = await bm25_coro
            vector_hits = await vector_coro
        elif bm25_coro:
            bm25_hits = await bm25_coro
        elif vector_coro:
            vector_hits = await vector_coro

        if mode == "bm25_only":
            fused = [(p, score, rank, None) for rank, (p, score) in enumerate(bm25_hits, start=1)]
        elif mode == "vector_only":
            fused = [(p, score, None, rank) for rank, (p, score) in enumerate(vector_hits, start=1)]
        else:
            fused = rrf_fuse(bm25_hits, vector_hits, limit, settings.RRF_K)

        contexts = [
            RetrievedPassage(
                passage_id=passage.id,
                source_id=passage.source_id,
                text=passage.text,
                status=passage.status.value if hasattr(passage.status, "value") else passage.status,
                quality_score=passage.quality_score,
                token_count=passage.token_count,
                retrieval_enabled=passage.retrieval_enabled,
                score=score,
                bm25_rank=bm25_rank,
                vector_rank=vector_rank,
                rrf_score=score if mode == "hybrid" else None,
                final_rank=rank,
                location=passage.location,
            )
            for rank, (passage, score, bm25_rank, vector_rank) in enumerate(fused, start=1)
        ]
        run = KbRetrievalRun(
            id=uuid4(),
            tenant_id=tenant_id,
            project_id=UUID(str(project_id)),
            query=query,
            mode=mode,
            filters=filters,
            latency_ms=round((monotonic() - started) * 1000),
            debug={"filters": filters},
        )
        self.session.add(run)
        await self.session.flush()
        for context in contexts:
            self.session.add(
                KbRetrievedPassage(
                    retrieval_run_id=run.id,
                    passage_id=UUID(str(context.passage_id)),
                    bm25_rank=context.bm25_rank,
                    vector_rank=context.vector_rank,
                    rrf_score=context.rrf_score,
                    final_rank=context.final_rank,
                    score=context.score,
                )
            )
        await self.session.commit()
        return RetrievalRunRecord(
            id=UUID(str(run.id)),
            tenant_id=tenant_id,
            project_id=UUID(str(project_id)),
            query=query,
            mode=mode,
            filters=filters,
            latency_ms=run.latency_ms,  # type: ignore
            contexts=contexts,
        )

    async def apply_curation_action(self, action: dict, _commit: bool = True) -> dict:
        action_type = action.get("type")
        source_id = action.get("sourceId")
        passage_id = action.get("passageId")
        target = None
        if source_id:
            target = await self.session.get(KbSource, UUID(str(source_id)))
        elif passage_id:
            target = await self.session.get(KbPassage, UUID(str(passage_id)))
        if target is None:
            return {"ok": False, "error": "target_not_found", "action": action}

        if action_type in {"certify_source", "certify_passage"}:
            target.status = CurationStatus.CERTIFIED.value  # type: ignore
        elif action_type in {"deprecate_source"}:
            target.status = CurationStatus.DEPRECATED.value  # type: ignore
        elif action_type in {"reject_source", "reject_passage"}:
            target.status = CurationStatus.REJECTED.value  # type: ignore
            target.retrieval_enabled = False  # type: ignore
        elif action_type in {"reset_source", "reset_passage"}:
            target.status = CurationStatus.CANDIDATE.value  # type: ignore
            target.retrieval_enabled = True  # type: ignore
        elif action_type in {"set_source_retrieval_enabled", "set_passage_retrieval_enabled"}:
            target.retrieval_enabled = bool(action.get("enabled"))  # type: ignore
        elif action_type == "add_quality_warning":
            warning = str(action.get("warning", "manual_warning"))
            warnings = list(target.quality_warnings or [])  # type: ignore
            if warning not in warnings:
                warnings.append(warning)
            target.quality_warnings = warnings  # type: ignore
        elif action_type == "clear_quality_warning":
            warning = action.get("warning")
            warnings = list(target.quality_warnings or [])  # type: ignore
            target.quality_warnings = [w for w in warnings if w != warning] if warning else []  # type: ignore
        else:
            return {"ok": False, "error": "unsupported_action", "action": action}

        if _commit:
            await self.session.commit()
        return {"ok": True, "action": action}

    async def apply_curation_actions(self, actions: list[dict]) -> list[dict]:
        source_ids = {UUID(str(a["sourceId"])) for a in actions if a.get("sourceId")}
        passage_ids = {UUID(str(a["passageId"])) for a in actions if a.get("passageId")}

        # Prefetch into the async session's identity map to eliminate O(N) SELECT queries
        if source_ids:
            await self.session.execute(select(KbSource).where(KbSource.id.in_(source_ids)))
        if passage_ids:
            await self.session.execute(select(KbPassage).where(KbPassage.id.in_(passage_ids)))

        results = []
        for action in actions:
            results.append(await self.apply_curation_action(action, _commit=False))
        await self.session.commit()
        return results

    async def export_passages(
        self, tenant_id: str, project_id: str, filters: dict, skip: int = 0, limit: int = 1000
    ) -> list[PassageRecord]:
        source_stmt = select(KbSource.id).where(
            KbSource.tenant_id == tenant_id,
            KbSource.project_id == UUID(str(project_id)),
        )
        if filters.get("retrievalEnabled", True):
            source_stmt = source_stmt.where(KbSource.retrieval_enabled.is_(True))
        source_status = filters.get("sourceStatus")
        if source_status:
            source_stmt = source_stmt.where(KbSource.status.in_(source_status))

        stmt = select(KbPassage).where(
            KbPassage.tenant_id == tenant_id,
            KbPassage.project_id == UUID(str(project_id)),
            KbPassage.source_id.in_(source_stmt),
        )
        if filters.get("retrievalEnabled", True):
            stmt = stmt.where(KbPassage.retrieval_enabled.is_(True))
        passage_status = filters.get("passageStatus")
        if passage_status:
            stmt = stmt.where(KbPassage.status.in_(passage_status))

        stmt = stmt.order_by(KbPassage.source_id, KbPassage.order).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return [PassageRecord.model_validate(passage) for passage in result.scalars().all()]

    async def _pg_vector_search(
        self,
        tenant_id: str,
        project_id: str,
        query_embedding: list[float],
        limit: int,
        filters: dict,
    ) -> list[tuple[PassageRecord, float]]:
        """pgvector cosine distance search via SQL."""
        from sqlalchemy import select

        source_stmt = select(KbSource.id).where(
            KbSource.tenant_id == tenant_id,
            KbSource.project_id == UUID(str(project_id)),
        )
        if filters.get("retrievalEnabled", True):
            source_stmt = source_stmt.where(KbSource.retrieval_enabled.is_(True))
        source_status = filters.get("sourceStatus")
        if source_status:
            source_stmt = source_stmt.where(KbSource.status.in_(source_status))

        distance = KbPassage.embedding.cosine_distance(query_embedding).label("distance")
        stmt = select(KbPassage, (1 - distance).label("score")).where(
            KbPassage.tenant_id == tenant_id,
            KbPassage.project_id == UUID(str(project_id)),
            KbPassage.embedding.is_not(None),
            KbPassage.source_id.in_(source_stmt),
        )

        if filters.get("retrievalEnabled", True):
            stmt = stmt.where(KbPassage.retrieval_enabled.is_(True))
        passage_status = filters.get("passageStatus")
        if passage_status:
            stmt = stmt.where(KbPassage.status.in_(passage_status))

        stmt = stmt.order_by(distance).limit(limit)

        result = await self.session.execute(stmt)
        hits = []
        for passage, score in result.all():
            hits.append((PassageRecord.model_validate(passage), float(score)))
        return hits

    async def _pg_bm25_search(
        self,
        tenant_id: str,
        project_id: str,
        query: str,
        limit: int,
        filters: dict,
    ) -> list[tuple[PassageRecord, float]]:
        """PostgreSQL full-text search via tsvector."""
        import re
        from sqlalchemy import select, func

        words = [w for w in re.split(r"\W+", query) if w]
        if not words:
            return []
        or_query = " | ".join(words)

        source_stmt = select(KbSource.id).where(
            KbSource.tenant_id == tenant_id,
            KbSource.project_id == UUID(str(project_id)),
        )
        if filters.get("retrievalEnabled", True):
            source_stmt = source_stmt.where(KbSource.retrieval_enabled.is_(True))
        source_status = filters.get("sourceStatus")
        if source_status:
            source_stmt = source_stmt.where(KbSource.status.in_(source_status))

        tsquery = func.to_tsquery("simple", or_query)
        score = func.ts_rank(KbPassage.search_vector, tsquery).label("score")

        stmt = select(KbPassage, score).where(
            KbPassage.tenant_id == tenant_id,
            KbPassage.project_id == UUID(str(project_id)),
            KbPassage.search_vector.op("@@")(tsquery),
            KbPassage.source_id.in_(source_stmt),
        )

        if filters.get("retrievalEnabled", True):
            stmt = stmt.where(KbPassage.retrieval_enabled.is_(True))
        passage_status = filters.get("passageStatus")
        if passage_status:
            stmt = stmt.where(KbPassage.status.in_(passage_status))

        stmt = stmt.order_by(score.desc()).limit(limit)

        result = await self.session.execute(stmt)
        hits = []
        for passage, score_val in result.all():
            hits.append((PassageRecord.model_validate(passage), float(score_val)))
        return hits

    async def list_topics(self, tenant_id: str, project_id: str):
        from app.storage.models import Topic
        from app.models import TopicRecord
        from sqlalchemy import select
        from uuid import UUID

        stmt = (
            select(Topic)
            .where(Topic.tenant_id == tenant_id, Topic.project_id == UUID(str(project_id)))
            .order_by(Topic.name)
        )

        result = await self.session.execute(stmt)
        return [TopicRecord.model_validate(t) for t in result.scalars()]

    async def get_concept_graph(self, tenant_id: str, project_id: str, min_weight: int = 2):
        from app.models import TopicEdge, ConceptGraphResponse
        from sqlalchemy import text

        # 1. Fetch nodes
        nodes = await self.list_topics(tenant_id, project_id)

        from app.settings import get_settings
        schema = get_settings().DB_SCHEMA
        # 2. Fetch edges based on cosine similarity of topic centroids using raw SQL
        # We only generate edges if cosine similarity > 0.6. The weight is scaled 1-10.
        stmt = text(f"""
            SELECT t1.id AS source, t2.id AS target, 
                   1 - (t1.embedding <=> t2.embedding) AS similarity
            FROM {schema}.kb_topics t1
            JOIN {schema}.kb_topics t2 ON t1.id < t2.id
            WHERE t1.tenant_id = :tenant_id
              AND t1.project_id = :project_id
              AND t2.tenant_id = :tenant_id
              AND t2.project_id = :project_id
              AND t1.embedding IS NOT NULL
              AND t2.embedding IS NOT NULL
              AND 1 - (t1.embedding <=> t2.embedding) > 0.6
        """)

        result = await self.session.execute(
            stmt, {"tenant_id": tenant_id, "project_id": str(project_id)}
        )

        edges = []
        for row in result:
            # Scale weight up for visualization. e.g., 0.6 -> ~2, 1.0 -> ~10
            weight = max(1, int((row.similarity - 0.6) * 25))
            edges.append(TopicEdge(source=row.source, target=row.target, weight=weight))

        return ConceptGraphResponse(nodes=nodes, edges=edges)
