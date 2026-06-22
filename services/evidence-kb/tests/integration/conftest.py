"""
Live Postgres integration tests for evidence-kb.

Requires:
- Postgres at localhost:5432 with user postgres / password from .env.eval
- Database `evidence_kb_test` must exist (created manually)
- pgvector extension must be available

Run only this directory:
    uv run pytest tests/integration/ -v
"""

import os

# Configure Postgres backend BEFORE importing any app modules
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:gas12kilo@localhost:5432/evidence_kb_test"
os.environ["STORAGE_BACKEND"] = "postgres"
os.environ["DB_SCHEMA"] = "evidence_kb_test_schema"
os.environ["API_KEY"] = "test-key"
os.environ["EMBEDDING_DIMENSIONS"] = "8"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["EMBEDDING_SERVICE_URL"] = ""

from sqlalchemy.pool import NullPool
import app.storage.db as db_module


def _init_schema_sync():
    """Initialize schema using SQLAlchemy sync engine to avoid event loop conflicts."""
    from sqlalchemy import create_engine, text
    from app.storage.models import Base

    engine = create_engine("postgresql+psycopg2://postgres:gas12kilo@localhost:5432/evidence_kb_test")
    schema = os.environ["DB_SCHEMA"]

    with engine.begin() as conn:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
        conn.execute(text(f"CREATE SCHEMA {schema}"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector CASCADE"))

    Base.metadata.create_all(engine)


def _truncate_tables_sync():
    """Truncate all tables using SQLAlchemy sync engine."""
    from sqlalchemy import create_engine
    from app.storage.models import Base

    engine = create_engine("postgresql+psycopg2://postgres:gas12kilo@localhost:5432/evidence_kb_test")
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


def _get_sessionmaker_with_null_pool():
    """Return a sessionmaker using NullPool so each checkout creates a fresh
    connection. This avoids asyncpg event-loop binding issues when the
    TestClient portal creates/destroys event loops between tests."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from app.settings import get_settings

    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    return async_sessionmaker(engine, expire_on_commit=False)


def reset_db_engine():
    """Reset the cached asyncpg engine and replace with NullPool variant."""
    db_module._engine = None
    db_module._sessionmaker = _get_sessionmaker_with_null_pool()


# Monkey-patch get_sessionmaker to use NullPool, avoiding event-loop binding issues.
# Must happen before any test creates a session.
_orig_get_sessionmaker = db_module.get_sessionmaker


def _patched_get_sessionmaker():
    if db_module._sessionmaker is None:
        db_module._sessionmaker = _get_sessionmaker_with_null_pool()
    return db_module._sessionmaker


db_module.get_sessionmaker = _patched_get_sessionmaker

# Initialize schema once at module load
_init_schema_sync()
