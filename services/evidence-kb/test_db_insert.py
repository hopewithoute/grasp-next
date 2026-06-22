import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.settings import get_settings

async def test():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        from sqlalchemy import text
        try:
            await conn.execute(text("SELECT '\x00'::text;"))
        except Exception as e:
            print("ERROR:", repr(e))

asyncio.run(test())
