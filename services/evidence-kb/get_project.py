import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.settings import get_settings

async def test():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        from sqlalchemy import text
        result = await conn.execute(text("SELECT tenant_id, project_id FROM evidence_kb.kb_sources LIMIT 1;"))
        row = result.first()
        if row:
            print(f"TENANT: {row[0]}")
            print(f"PROJECT: {row[1]}")
        else:
            print("NO SOURCES")

asyncio.run(test())
