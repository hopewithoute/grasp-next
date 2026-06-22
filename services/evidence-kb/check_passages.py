import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.settings import get_settings

async def test():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        from sqlalchemy import text
        result = await conn.execute(text("SELECT text FROM evidence_kb.kb_passages ORDER BY created_at DESC LIMIT 5;"))
        for row in result:
            print("--- CHUNK ---")
            print(row[0])
            print("-------------")

asyncio.run(test())
