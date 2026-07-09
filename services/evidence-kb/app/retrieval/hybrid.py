from app.models import PassageRecord


def rrf_fuse(
    bm25_hits: list[tuple[PassageRecord, float]],
    vector_hits: list[tuple[PassageRecord, float]],
    top_k: int,
    rrf_k: int = 60,  # Nilai default default standar RRF adalah 60
) -> list[tuple[PassageRecord, float, int | None, int | None]]:

    from uuid import UUID

    by_id: dict[UUID, PassageRecord] = {}
    scores: dict[UUID, float] = {}  # Menggunakan dict standar
    bm25_ranks: dict[UUID, int] = {}
    vector_ranks: dict[UUID, int] = {}

    def _process_hits(hits: list[tuple[PassageRecord, float]], ranks: dict[UUID, int]) -> None:
        for rank, (passage, _) in enumerate(hits, start=1):
            by_id[passage.id] = passage
            ranks[passage.id] = rank

            # Menggunakan .get() untuk handle key yang belum ada
            scores[passage.id] = scores.get(passage.id, 0.0) + (1 / (rrf_k + rank))

    _process_hits(bm25_hits, bm25_ranks)
    _process_hits(vector_hits, vector_ranks)

    # Mengurutkan id berdasarkan skor tertinggi
    ranked_ids = sorted(scores, key=scores.__getitem__, reverse=True)[:top_k]

    return [(by_id[pid], scores[pid], bm25_ranks.get(pid), vector_ranks.get(pid)) for pid in ranked_ids]
