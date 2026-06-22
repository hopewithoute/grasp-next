import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.settings import get_settings

async def test():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        from sqlalchemy import text
        result = await conn.execute(text("SELECT id, tenant_id, project_id, title FROM evidence_kb.kb_sources ORDER BY created_at DESC LIMIT 5;"))
        print("Sources:")
        for row in result:
            print(f"- {row[3]} | Tenant: {row[1]} | Project: {row[2]} | Source ID: {row[0]}")

asyncio.run(test())
