import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.settings import get_settings

async def test():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        from sqlalchemy import text
        result = await conn.execute(text("SELECT id, status, failure_reason FROM evidence_kb.kb_ingestion_runs ORDER BY created_at DESC LIMIT 3;"))
        print("Ingestion Runs:")
        for row in result:
            print(f"- Run ID: {row[0]}, Status: {row[1]}, Error: {row[2]}")

        result2 = await conn.execute(text("SELECT count(*), bool_or(embedding IS NOT NULL) FROM evidence_kb.kb_passages;"))
        row = result2.first()
        print(f"Total passages: {row[0]}, Any has vector: {row[1]}")

asyncio.run(test())
