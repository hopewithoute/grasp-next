import asyncio
from sqlalchemy import select
from app.models import KbPassage

async def main():
    stmt = select(KbPassage)
    order_col = KbPassage.order
    sort_func = order_col.asc
    stmt = stmt.order_by(sort_func().nullslast())
    print(stmt)

if __name__ == "__main__":
    asyncio.run(main())
