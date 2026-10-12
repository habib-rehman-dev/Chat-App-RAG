from collections.abc import AsyncIterator
from typing import Any

# This file is using the async the latest and if somethign is sync then i have to change them
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.core.config import get_settings

settings = get_settings()  # type: ignore
# type: ignore

database_url = (
    settings.LOCAL_DATABASE_URL if settings.USE_LOCAL_DB else settings.DATABASE_URL
)
engine_options: dict[str, Any] = {
    "echo": settings.sql_echo,
    "pool_pre_ping": True,
}
if not database_url.startswith("sqlite"):
    engine_options.update(pool_size=10, max_overflow=20)

engine = create_async_engine(
    database_url,
    **engine_options,
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    # Import models so they register on Base.metadata before create_all.
     # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_db() -> None:
    await engine.dispose()


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
