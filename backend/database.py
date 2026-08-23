import os
import uuid
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, UniqueConstraint, select
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
    # 0 = legacy: password_hash is bcrypt over the RAW password.
    # 1 = split-KDF: bcrypt over the client-derived authSecret, so the server
    #     never sees the password and cannot derive the encryption key.
    # Accounts upgrade transparently on their next successful login.
    kdf_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Nullable: an anonymous report/feedback snapshot (see message_feedback
    # below) is a masked-only conversation with no owner at all.
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    # Persistent per-browser secret (client localStorage), required to read/
    # write an ownerless conversation. Set once at creation, only when
    # user_id is null — knowing the conversation's own id is no longer
    # sufficient on its own to open it.
    anon_key: Mapped[str] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Percakapan")
    doc_name: Mapped[str] = mapped_column(String(255), nullable=True)
    # Everything below is stored MASKED (<PERSON_1> etc.) or encrypted. The
    # server holds no readable PII by construction.
    masked_text: Mapped[str] = mapped_column(Text, nullable=True)
    messages: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # base64(iv ‖ AES-GCM ciphertext), encrypted client-side. Opaque here.
    pii_mapping_enc: Mapped[str] = mapped_column(Text, nullable=True)
    # Risk dashboard + citations from the last analysis. Same trust level as
    # `messages` (masked/tag-form free text) — client remasks before sending,
    # unmasks after loading, same as message content.
    risks: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=True)
    citations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # Upload metadata only (page count, whether OCR ran, per-page OCR flags) —
    # no page text. The raw/OCR'd document text itself is never persisted;
    # this just lets a resumed conversation show the same "N hlm · OCR" badge
    # it had live, without carrying any document content server-side.
    doc_meta: Mapped[dict] = mapped_column(JSONB, nullable=True)
    # Optimistic concurrency. Autosave writes the WHOLE conversation, so two
    # tabs open on the same one used to overwrite each other silently, newest
    # write winning and the other tab's turns vanishing on next reload.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class MessageFeedback(Base):
    __tablename__ = "message_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Nullable: a logged-out visitor can react/report too (see /messages/{id}/feedback).
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    # Nullable only for the brief window before a just-started conversation
    # has been saved/snapshotted at all. Normally populated — for a logged-in
    # user it's their real saved conversation; for an anonymous one it's the
    # ownerless snapshot created on first reaction (see report-snapshot route).
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=True)
    # Client-generated id (chat message "msg_xxx", or the "pii_review_<sessionId>"
    # sentinel for a masking-review report) — not a DB foreign key, messages
    # live inside Conversation.messages JSONB, not their own table.
    message_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    # Same persistent per-browser secret as Conversation.anon_key — without
    # it, two different anonymous browsers reacting to the same message_id
    # would collide on the same row (user_id IS NULL matches both).
    anon_key: Mapped[str] = mapped_column(String(64), nullable=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False)  # "up" | "down" | "report"
    report_reason: Mapped[str] = mapped_column(Text, nullable=True)
    # Optional, user-opted-in JSON dump of the REAL (decrypted) PII mapping —
    # tag -> actual value — attached to a report so the team can review it
    # with full context. Unlike everything else this server stores, this is
    # a deliberate, explicit exception to "no readable PII server-side": the
    # user chose to send it, off by default, with a clear warning in the UI.
    censored_excerpt: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        # One active reaction per user per message — clicking up/down/report
        # replaces the row rather than accumulating one each, matching the
        # "the other reaction is removed" UI behavior.
        UniqueConstraint("user_id", "message_id", name="uq_message_feedback_user_message"),
    )


def _remask(value: str, mapping: dict) -> str:
    """Replace real values with their tags. Mirrors remaskText in
    frontend/src/lib/pii.ts — longest value first, so a short value that is a
    substring of a longer one cannot corrupt it."""
    if not value or not mapping:
        return value or ""
    out = value
    for tag, real in sorted(mapping.items(), key=lambda kv: -len(str(kv[1] or ""))):
        if real:
            out = out.replace(str(real), tag)
    return out


async def _drop_plaintext_pii(conn):
    """One-time: re-mask stored messages with each row's own plaintext mapping,
    then drop the column.

    Conversations used to be stored fully unmasked (the frontend unmasked
    replies before persisting), alongside a literal tag -> real value table.
    That is exactly the data the product promises never to leave the browser.

    IRREVERSIBLE: after this the mapping needed to un-tag old conversations is
    gone, so they render as <PERSON_1> permanently. That is the point — nothing
    readable is left server-side.
    """
    from sqlalchemy import text
    import json

    exists = await conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='conversations' AND column_name='pii_mapping'"
    ))
    if not exists.first():
        return  # already migrated

    rows = (await conn.execute(text(
        "SELECT id, messages, pii_mapping FROM conversations"
    ))).fetchall()

    migrated = 0
    for conv_id, messages, mapping in rows:
        if isinstance(messages, str):
            messages = json.loads(messages or "[]")
        if isinstance(mapping, str):
            mapping = json.loads(mapping or "{}")
        if not mapping or not isinstance(messages, list):
            continue
        for m in messages:
            if isinstance(m, dict) and isinstance(m.get("content"), str):
                m["content"] = _remask(m["content"], mapping)
        await conn.execute(
            text("UPDATE conversations SET messages = CAST(:m AS JSONB) WHERE id = :id"),
            {"m": json.dumps(messages), "id": conv_id},
        )
        migrated += 1

    await conn.execute(text("ALTER TABLE conversations DROP COLUMN pii_mapping"))
    logger.warning(
        "Privacy migration: re-masked %d/%d conversations and dropped the plaintext "
        "pii_mapping column. Older conversations now render as tags.",
        migrated, len(rows),
    )


async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # create_all only creates missing tables, not missing columns on an
            # existing one — no migration framework here, so patch it idempotently.
            from sqlalchemy import text
            for ddl in (
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS kdf_version INTEGER NOT NULL DEFAULT 0",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS masked_text TEXT",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pii_mapping_enc TEXT",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS risks JSONB NOT NULL DEFAULT '[]'::jsonb",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS risk_score INTEGER",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS citations JSONB NOT NULL DEFAULT '[]'::jsonb",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS doc_meta JSONB",
                "ALTER TABLE conversations ALTER COLUMN user_id DROP NOT NULL",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS anon_key VARCHAR(64)",
                "ALTER TABLE message_feedback ADD COLUMN IF NOT EXISTS anon_key VARCHAR(64)",
            ):
                await conn.execute(text(ddl))
            await _drop_plaintext_pii(conn)
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
