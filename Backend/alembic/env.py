# # alembic/env.py
# import asyncio, os, sys
# from logging.config import fileConfig
# from alembic import context
# from src.core.config import get_settings
# from sqlalchemy import pool
# from sqlalchemy.engine import Connection
# from sqlalchemy.ext.asyncio import async_engine_from_config

# sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
# from src.core.database import Base, database_url
# from src.features.chat.models import ChatMessage, ChatSession
# from src.features.documents.models import Document


# settings = get_settings()

# config = context.config
# if config.config_file_name:
#     fileConfig(config.config_file_name)
# config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
# target_metadata = Base.metadata

# def run_migrations_offline() -> None:
#     context.configure(url=database_url, target_metadata=target_metadata,
#                       literal_binds=True, dialect_opts={"paramstyle": "named"})
#     with context.begin_transaction():
#         context.run_migrations()

# def do_run_migrations(connection: Connection) -> None:
#     context.configure(connection=connection, target_metadata=target_metadata)
#     with context.begin_transaction():
#         context.run_migrations()

# async def run_async_migrations() -> None:
#     connectable = async_engine_from_config(
#         config.get_section(config.config_ini_section, {}),
#         prefix="sqlalchemy.", poolclass=pool.NullPool,
#     )
#     async with connectable.connect() as conn:
#         await conn.run_sync(do_run_migrations)
#     await connectable.dispose()

# if context.is_offline_mode():
#     run_migrations_offline()
# else:
#     asyncio.run(run_async_migrations())


import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.core.config import get_settings
from src.core.database import Base
from src.features.chat.models import ChatMessage, ChatSession  # noqa: F401
from src.features.documents.models import Document  # noqa: F401

settings = get_settings()
config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _async_url(url: str) -> str:
    """Make sure the URL uses the asyncpg driver."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+asyncpg://" + url[len(prefix) :]
    return url


DB_URL = _async_url(str(settings.DATABASE_URL))


def run_migrations_offline() -> None:
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(
        DB_URL,
        poolclass=pool.NullPool,
        # Needed if you ever point at Supabase's transaction pooler (port 6543).
        connect_args={"statement_cache_size": 0},
    )
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
