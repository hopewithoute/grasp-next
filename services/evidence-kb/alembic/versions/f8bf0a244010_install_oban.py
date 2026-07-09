"""install_oban

Revision ID: f8bf0a244010
Revises: 70678a229903
Create Date: 2026-06-23 23:40:30.820811

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from oban.schema import install_sql, uninstall_sql
import psycopg

# revision identifiers, used by Alembic.
revision: str = 'f8bf0a244010'
down_revision: Union[str, Sequence[str], None] = '70678a229903'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

from app.settings import get_settings

def upgrade() -> None:
    settings = get_settings()
    dsn = settings.DATABASE_URL.replace('+asyncpg', '')
    
    with psycopg.connect(dsn) as conn:
        conn.execute(install_sql())
        conn.commit()

def downgrade() -> None:
    settings = get_settings()
    dsn = settings.DATABASE_URL.replace('+asyncpg', '')
    
    with psycopg.connect(dsn) as conn:
        conn.execute(uninstall_sql())
        conn.commit()
