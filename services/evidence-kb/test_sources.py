import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.settings import get_settings

async def test():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        from sqlalchemy import text
        result = await conn.execute(text("SELECT id, external_source_id FROM evidence_kb.kb_sources LIMIT 5;"))
        for row in result:
            print(f"id: {row[0]}, external_source_id: {row[1]}")

asyncio.run(test())
