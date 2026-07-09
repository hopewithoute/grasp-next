from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from psycopg_pool import AsyncConnectionPool
from oban import Oban
import logging

from app.settings import get_settings
from app.workers import EvidenceIngestionWorker  # Imports the worker

logger = logging.getLogger(__name__)

global_pool: AsyncConnectionPool | None = None
oban_instance: Oban | None = None

@asynccontextmanager
async def oban_lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global global_pool, oban_instance
    settings = get_settings()
    dsn = settings.DATABASE_URL.replace('+asyncpg', '')
    
    logger.info("Initializing Oban connection pool")
    global_pool = AsyncConnectionPool(dsn, open=False)
    await global_pool.open()
    
    oban_instance = Oban(pool=global_pool, queues={"ingestion": 10})
    app.state.oban = oban_instance
    
    await oban_instance.start()
    logger.info("Oban started")
    
    yield
    
    logger.info("Stopping Oban...")
    await oban_instance.stop()
    await global_pool.close()
    logger.info("Oban connection pool closed")

def get_oban_pool() -> AsyncConnectionPool:
    if not global_pool:
        raise RuntimeError("Oban pool is not initialized")
    return global_pool

def get_oban_instance() -> Oban:
    if not oban_instance:
        raise RuntimeError("Oban instance is not initialized")
    return oban_instance
