import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.settings import get_settings

async def test():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        from sqlalchemy import text
        result = await conn.execute(text("SELECT id, text, CASE WHEN embedding IS NOT NULL THEN 'HAS VECTOR' ELSE 'NO VECTOR' END as has_vector FROM evidence_kb.kb_passages ORDER BY created_at DESC LIMIT 5;"))
        for row in result:
            print(f"ID: {row[0]}, Vector: {row[2]}")

asyncio.run(test())
