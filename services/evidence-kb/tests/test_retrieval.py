import uuid
from app.retrieval.hybrid import rrf_fuse
from app.models import Location, PassageRecord


def passage(pid: str) -> PassageRecord:
    pid_int = int(pid)
    return PassageRecord(
        id=uuid.UUID(int=pid_int),
        tenant_id="t",
        project_id=uuid.UUID(int=100),
        source_id=uuid.UUID(int=200),
        block_id=pid,
        text=f"passage {pid}",
        kind="text",
        location=Location(),
        order=0,
        token_count=3,
        quality_score=1,
    )


def test_rrf_fuse_combines_bm25_and_vector_ranks():
    p1 = passage("1")
    p2 = passage("2")
    p3 = passage("3")

    fused = rrf_fuse([(p1, 1), (p2, 0.5)], [(p2, 1), (p3, 0.5)], top_k=3, rrf_k=60)

    assert fused[0][0].id == uuid.UUID(int=2)
    assert {item[0].id for item in fused} == {uuid.UUID(int=1), uuid.UUID(int=2), uuid.UUID(int=3)}

