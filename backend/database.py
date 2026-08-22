import os
import uuid
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, DateTime, ForeignKey, select
from sqlalchemy.dialects.postgresql import JSONB, JSON

logger = logging.getLogger("pasalberapa.db")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    os.environ.get("POSTGRES_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/pasalberapa")
)

# Normalize postgres:// to postgresql+asyncpg://
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Percakapan")
    doc_name: Mapped[str] = mapped_column(String(255), nullable=True)
    messages: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    pii_mapping: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # create_all only creates missing tables, not missing columns on an
            # existing one — no migration framework here, so patch it idempotently.
            from sqlalchemy import text
            await conn.execute(text(
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pii_mapping JSONB NOT NULL DEFAULT '{}'::jsonb"
            ))
        logger.info("PostgreSQL database tables initialized.")
    except Exception as e:
        logger.warning(f"Could not connect to PostgreSQL on init: {e}")

async def close_db():
    await engine.dispose()
    logger.info("PostgreSQL engine connection closed.")

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
