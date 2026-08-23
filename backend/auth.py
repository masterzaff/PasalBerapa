"""
PasalBerapa? — Auth + Saved Conversations (PostgreSQL).
Anonymous by default. Users may register ONLY to save their chats.
Email/password + JWT (bcrypt hashing). Stored in PostgreSQL with JSONB messages.
"""
import os
import uuid
import bcrypt
import httpx
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, false

import ai_client
from database import get_db, User, Conversation, MessageFeedback

JWT_SECRET = os.environ.get("JWT_SECRET", "pasalberapa-dev-secret-change-me")
JWT_ALG = "HS256"
JWT_TTL_DAYS = 30

auth_router = APIRouter(prefix="/api")


# ---------- Models ----------
CURRENT_KDF = 1


class RegisterReq(BaseModel):
    email: EmailStr
    # Client-derived authSecret (split-KDF), never the raw password. `password`
    # stays accepted so a legacy client still works, but new accounts are v1.
    auth_secret: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6)
    name: Optional[str] = None


class LoginReq(BaseModel):
    email: EmailStr
    auth_secret: Optional[str] = None
    password: Optional[str] = None


class UpgradeKdfReq(BaseModel):
    auth_secret: str
    current_password: str


class ReencryptedMapping(BaseModel):
    id: str
    pii_mapping_enc: str


class ChangePasswordReq(BaseModel):
    current_auth_secret: str
    new_auth_secret: str
    # Every mapping, decrypted with the OLD key and re-encrypted with the NEW
    # one, client-side. Sent WITH the password change because the two must land
    # together: change the password alone and every mapping is orphaned, since
    # the key that opens them is derived from the password.
    reencrypted: List[ReencryptedMapping] = []


class SendMessageReq(BaseModel):
    mode: str
    # Already masked client-side — the server never sees a raw question.
    question: Optional[str] = None
    # Only honored when this call creates a brand-new conversation (first
    # message). Ignored on every later call against an existing one — those
    # fields change only through PUT /conversations/{id}/mapping.
    masked_text: Optional[str] = None
    doc_name: Optional[str] = None
    doc_meta: Optional[Dict[str, Any]] = None
    pii_mapping_enc: Optional[str] = None


class EditMessageReq(BaseModel):
    content: str  # already masked client-side


class MappingUpdateReq(BaseModel):
    masked_text: Optional[str] = None
    # base64(iv ‖ AES-GCM ciphertext). Opaque to the server, by design.
    pii_mapping_enc: Optional[str] = None


class ConversationRename(BaseModel):
    title: str


# ---------- Helpers ----------
class FeedbackIn(BaseModel):
    type: str  # "up" | "down" | "report"
    conversation_id: Optional[str] = None
    report_reason: Optional[str] = None
    censored_excerpt: Optional[str] = None


def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_TTL_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def _public_user(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name or u.email.split("@")[0]
    }


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sesi login diperlukan.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi login telah kedaluwarsa, silakan masuk kembali.")
    except Exception:
        raise HTTPException(status_code=401, detail="Token otentikasi tidak valid.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Data pengguna tidak valid.")
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan.")
    return u


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Like get_current_user but never raises — a missing/expired/invalid
    token just means "anonymous", for routes logged-out visitors may use too
    (message feedback)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


# ---------- Auth routes ----------
@auth_router.get("/auth/params")
async def auth_params(email: str, db: AsyncSession = Depends(get_db)):
    """Which KDF the client should use for this account.

    Unknown emails return the CURRENT version rather than 404, so this cannot be
    used to enumerate registered accounts. The salt itself is not returned — it
    is derived from the email client-side, so there is nothing to leak.
    """
    res = await db.execute(select(User).where(User.email == (email or "").lower().strip()))
    u = res.scalar_one_or_none()
    return {"kdf_version": u.kdf_version if u else CURRENT_KDF}


@auth_router.post("/auth/register")
async def register(req: RegisterReq, db: AsyncSession = Depends(get_db)):
    email = req.email.lower().strip()
    secret = req.auth_secret or req.password
    if not secret:
        raise HTTPException(status_code=422, detail="Kata sandi diperlukan.")
    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email ini sudah terdaftar. Silakan login.")

    try:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=req.name.strip() if req.name else None,
            kdf_version=CURRENT_KDF if req.auth_secret else 0,
            password_hash=_hash_pw(secret),
            created_at=datetime.now(timezone.utc)
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return {"token": _make_token(user.id), "user": _public_user(user)}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mendaftarkan akun: {str(e)}")


@auth_router.post("/auth/login")
async def login(req: LoginReq, db: AsyncSession = Depends(get_db)):
    email = req.email.lower().strip()
    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    u = res.scalar_one_or_none()
    # v1 accounts verify the client-derived authSecret; v0 the raw password.
    # The client picks which to send from GET /auth/params.
    secret = req.auth_secret if (u and u.kdf_version >= 1) else req.password
    if not u or not secret or not _verify_pw(secret, u.password_hash):
        raise HTTPException(status_code=401, detail="Email atau kata sandi tidak sesuai.")
    return {"token": _make_token(u.id), "user": _public_user(u), "kdf_version": u.kdf_version}


@auth_router.post("/auth/upgrade-kdf")
async def upgrade_kdf(
    req: UpgradeKdfReq,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move a legacy (v0) account onto the split-KDF, once, after it has just
    authenticated with its real password. From here the server only ever sees
    the derived authSecret."""
    if current.kdf_version >= CURRENT_KDF:
        return {"kdf_version": current.kdf_version}
    if not _verify_pw(req.current_password, current.password_hash):
        raise HTTPException(status_code=401, detail="Kata sandi saat ini tidak sesuai.")
    current.password_hash = _hash_pw(req.auth_secret)
    current.kdf_version = CURRENT_KDF
    await db.commit()
    return {"kdf_version": current.kdf_version}


@auth_router.post("/auth/change-password")
async def change_password(
    req: ChangePasswordReq,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate the password AND every re-encrypted mapping in one transaction.

    The encryption key is derived from the password, so these cannot be
    separate operations: a half-applied rotation leaves some conversations
    readable and some permanently opaque. Either both land or neither does.

    The server cannot verify the re-encryption is correct — the blobs are opaque
    to it. That check belongs to the client, which decrypts with the old key
    before re-encrypting, and refuses to proceed on anything it could not read.
    """
    if current.kdf_version < CURRENT_KDF:
        raise HTTPException(
            status_code=409,
            detail="Akun ini belum memakai KDF terbaru. Masuk ulang sekali, lalu coba lagi.",
        )
    if not _verify_pw(req.current_auth_secret, current.password_hash):
        raise HTTPException(status_code=401, detail="Kata sandi saat ini tidak sesuai.")

    try:
        if req.reencrypted:
            ids = [m.id for m in req.reencrypted]
            res = await db.execute(
                select(Conversation).where(
                    Conversation.id.in_(ids),
                    Conversation.user_id == current.id,
                )
            )
            owned = {c.id: c for c in res.scalars().all()}
            missing = [i for i in ids if i not in owned]
            if missing:
                # Refuse rather than partially apply: the client believes it has
                # rotated everything, and silently dropping some would leave
                # unreadable conversations it never warned about.
                raise HTTPException(
                    status_code=400,
                    detail=f"{len(missing)} percakapan tidak ditemukan; rotasi dibatalkan.",
                )
            for m in req.reencrypted:
                owned[m.id].pii_mapping_enc = m.pii_mapping_enc

        current.password_hash = _hash_pw(req.new_auth_secret)
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengganti kata sandi: {str(e)}")

    # Old JWTs stay valid (they carry only the user id), so hand back a fresh one
    # for symmetry with login rather than implying the old one was revoked.
    return {"token": _make_token(current.id), "rotated": len(req.reencrypted)}


@auth_router.get("/auth/me")
async def me(current: User = Depends(get_current_user)):
    return {"user": _public_user(current)}


# ---------- Conversations (private per user) ----------
def _owned_by(column, owner_id: Optional[str]):
    """SQLAlchemy filter for "belongs to this owner", where owner_id=None
    means an anonymous/ownerless row (column IS NULL) rather than "no filter"."""
    return column == owner_id if owner_id else column.is_(None)


def _conv_access(current: Optional[User], anon_key: Optional[str]):
    """Access filter for a Conversation row. A logged-in user must own it.
    An anonymous caller must both hit an ownerless row AND present the same
    persistent per-browser key that row was created with — knowing the
    conversation's own id is no longer enough on its own to open it."""
    if current:
        return Conversation.user_id == current.id
    if not anon_key:
        return false()
    return and_(Conversation.user_id.is_(None), Conversation.anon_key == anon_key)


def _conv_summary(c: Conversation) -> dict:
    return {
        "id": c.id,
        "title": c.title or "Percakapan",
        "doc_name": c.doc_name,
        "count": len(c.messages) if isinstance(c.messages, list) else 0,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ---------- Message actions: send / edit / regenerate ----------
# The client only ever asks for one of these three things; the server is the
# one that appends to / mutates the JSONB `messages` array and calls ai_node
# — never a client-computed full-conversation blob written wholesale.

MODE_LABELS = {
    "risk": "Bedah Risiko (Red Flags)",
    "summary": "Ringkas Isi",
    "key_articles": "Jelaskan Pasal Terpenting",
    "chat": "Pertanyaan",
}


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _new_message_id() -> str:
    return "msg_" + uuid.uuid4().hex[:9]


def _build_history(messages: List[dict], exclude_id: Optional[str] = None) -> List[dict]:
    hist = [
        {"role": m.get("role"), "content": m.get("content", "")}
        for m in messages
        if m.get("role") and not m.get("error") and m.get("id") != exclude_id
    ]
    return hist[-8:]


async def _call_analyze(masked_text, mode, question, history):
    """Call ai_node's /analyze. Returns (data, error_message) — exactly one
    is non-empty. Mirrors the try/except AnalysisContext.tsx used to do
    client-side; the "coba lagi" copy is the same the client used to show."""
    try:
        data = await ai_client.analyze({
            "masked_text": masked_text or "",
            "mode": mode,
            "question": question,
            "history": history,
        })
        return data, None
    except ai_client.AiNodeBusyError:
        return {}, "Server sedang sibuk, coba lagi sebentar"
    except httpx.HTTPStatusError as e:
        return {}, f"AI Node error {e.response.status_code}"
    except (httpx.ConnectError, httpx.ConnectTimeout):
        return {}, "AI Node sedang offline atau belum siap"
    except httpx.TimeoutException:
        return {}, "AI Node timeout saat menganalisis"
    except Exception as e:
        return {}, str(e)


@auth_router.get("/conversations")
async def list_conversations(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Conversation).where(Conversation.user_id == current.id).order_by(Conversation.updated_at.desc())
    res = await db.execute(stmt)
    conversations_list = res.scalars().all()
    items = [_conv_summary(c) for c in conversations_list]
    return {"items": items}


@auth_router.get("/conversations/secrets")
async def list_conversation_secrets(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Every encrypted mapping this user owns, for a client-side key rotation.

    Opaque blobs only — no messages, no titles. Declared BEFORE the
    /conversations/{conv_id} route so "secrets" isn't captured as an id.
    """
    res = await db.execute(
        select(Conversation).where(
            Conversation.user_id == current.id,
            Conversation.pii_mapping_enc.isnot(None),
        )
    )
    return {"items": [{"id": c.id, "pii_mapping_enc": c.pii_mapping_enc} for c in res.scalars().all()]}


@auth_router.post("/conversations/{conv_id}/messages")
async def send_message(
    conv_id: str,
    body: SendMessageReq,
    current: Optional[User] = Depends(get_current_user_optional),
    x_anon_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Send a message. Creates the conversation (ownerless if anonymous) on
    the first call for a given conv_id, then appends to it on every later
    one. The server builds history from its own stored messages and calls
    ai_node itself — the client never computes or ships the next full state."""
    owner_id = current.id if current else None
    now = datetime.now(timezone.utc)

    stmt = select(Conversation).where(
        Conversation.id == conv_id,
        _conv_access(current, x_anon_key),
    ).with_for_update()
    c = (await db.execute(stmt)).scalar_one_or_none()

    effective_question = body.question or MODE_LABELS.get(body.mode, "Analisis")

    if c is None:
        # Distinguish "brand new id" (create it) from "exists but belongs to
        # someone/somewhere else" (reject) — otherwise a mismatched anon_key
        # would fall through to an INSERT on an already-taken primary key.
        taken = (await db.execute(select(Conversation.id).where(Conversation.id == conv_id))).scalar_one_or_none()
        if taken is not None:
            raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan.")
        c = Conversation(
            id=conv_id,
            user_id=owner_id,
            anon_key=x_anon_key if not current else None,
            title=(body.doc_name or effective_question or "Percakapan").strip()[:140] or "Percakapan",
            doc_name=body.doc_name,
            masked_text=body.masked_text,
            pii_mapping_enc=body.pii_mapping_enc if current else None,
            doc_meta=body.doc_meta,
            messages=[],
            risks=[],
            citations=[],
            created_at=now,
            updated_at=now,
        )
        db.add(c)

    # Mode tamu (unauthenticated): dibatasi 1 giliran (turn) per percakapan
    if current is None:
        user_turn_count = len([m for m in (c.messages or []) if m.get("role") == "user"])
        if user_turn_count >= 1:
            raise HTTPException(
                status_code=403,
                detail="Mode tamu dibatasi 1 pesan per percakapan. Buat akun untuk melanjutkan percakapan ini."
            )

    try:
        messages = list(c.messages or [])
        user_msg = {
            "id": _new_message_id(),
            "role": "user",
            "mode": body.mode,
            "content": effective_question,
            "ts": _now_ms(),
        }
        messages.append(user_msg)
        history = _build_history(messages, exclude_id=user_msg["id"])

        data, err = await _call_analyze(c.masked_text, body.mode, body.question, history)
        if err:
            assistant_msg = {
                "id": _new_message_id(), "role": "assistant", "mode": body.mode,
                "content": f"Terjadi kendala saat menganalisis dokumen: {err}. Silakan coba lagi.",
                "error": True, "ts": _now_ms(),
            }
        else:
            reply = data.get("reply") or data.get("summary") or "Selesai."
            assistant_msg = {
                "id": _new_message_id(), "role": "assistant", "mode": body.mode, "content": reply,
                "citations": data.get("citations") or [], "actions": data.get("actions") or [],
                "sentMasked": body.question or effective_question, "receivedRaw": reply,
                "error": False, "ts": _now_ms(),
            }
            if isinstance(data.get("risks"), list):
                c.risks = data["risks"]
            if isinstance(data.get("risk_score"), int):
                c.risk_score = data["risk_score"]
            if isinstance(data.get("citations"), list):
                c.citations = data["citations"]
        messages.append(assistant_msg)

        c.messages = messages
        c.updated_at = datetime.now(timezone.utc)
        c.version = (c.version or 0) + 1
        await db.commit()
        return {
            "id": c.id, "version": c.version, "title": c.title,
            "user_message": user_msg, "assistant_message": assistant_msg,
            "risks": c.risks, "risk_score": c.risk_score, "citations": c.citations,
            "debug": data.get("debug"),
        }
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengirim pesan: {str(e)}")


@auth_router.patch("/conversations/{conv_id}/messages/{message_id}")
async def edit_message(
    conv_id: str,
    message_id: str,
    body: EditMessageReq,
    current: Optional[User] = Depends(get_current_user_optional),
    x_anon_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Edit a user message. If it's followed by an assistant reply, that
    reply is regenerated in the same request — server-owned, atomic, no
    separate client round-trip like the old run({regenerateMessageId}) chain."""
    stmt = select(Conversation).where(
        Conversation.id == conv_id,
        _conv_access(current, x_anon_key),
    ).with_for_update()
    c = (await db.execute(stmt)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan.")

    trimmed = (body.content or "").strip()
    if not trimmed:
        raise HTTPException(status_code=422, detail="Pesan tidak boleh kosong.")

    messages = list(c.messages or [])
    idx = next((i for i, m in enumerate(messages) if m.get("id") == message_id), None)
    if idx is None or messages[idx].get("role") != "user":
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan.")

    target = messages[idx]
    if target.get("content") == trimmed:
        return {"id": c.id, "version": c.version, "user_message": target, "assistant_message": None}

    try:
        now_ms = _now_ms()
        prev_snapshot = {"content": target.get("content"), "mode": target.get("mode"), "ts": target.get("ts") or now_ms}
        target = {**target, "content": trimmed, "versions": [*(target.get("versions") or []), prev_snapshot], "ts": now_ms}
        messages[idx] = target
        mode = target.get("mode") or "chat"

        history = _build_history(messages[: idx + 1], exclude_id=None)
        data, err = await _call_analyze(c.masked_text, mode, trimmed, history)

        next_msg = messages[idx + 1] if idx + 1 < len(messages) else None
        if err:
            new_fields = {
                "content": f"Terjadi kendala saat menganalisis dokumen: {err}. Silakan coba lagi.",
                "error": True,
            }
        else:
            reply = data.get("reply") or data.get("summary") or "Selesai."
            new_fields = {
                "content": reply, "citations": data.get("citations") or [], "actions": data.get("actions") or [],
                "sentMasked": trimmed, "receivedRaw": reply, "error": False,
            }
            if isinstance(data.get("risks"), list):
                c.risks = data["risks"]
            if isinstance(data.get("risk_score"), int):
                c.risk_score = data["risk_score"]
            if isinstance(data.get("citations"), list):
                c.citations = data["citations"]

        if next_msg and next_msg.get("role") == "assistant":
            prev_a_snapshot = {
                "content": next_msg.get("content"), "citations": next_msg.get("citations"),
                "actions": next_msg.get("actions"), "sentMasked": next_msg.get("sentMasked"),
                "receivedRaw": next_msg.get("receivedRaw"), "mode": next_msg.get("mode"),
                "error": next_msg.get("error") or False, "ts": next_msg.get("ts") or now_ms,
            }
            assistant_msg = {
                **next_msg, **new_fields, "mode": mode,
                "versions": [*(next_msg.get("versions") or []), prev_a_snapshot],
                "ts": _now_ms(),
            }
            messages[idx + 1] = assistant_msg
        else:
            assistant_msg = {"id": _new_message_id(), "role": "assistant", "mode": mode, "ts": _now_ms(), **new_fields}
            messages.insert(idx + 1, assistant_msg)

        c.messages = messages
        c.updated_at = datetime.now(timezone.utc)
        c.version = (c.version or 0) + 1
        await db.commit()
        return {
            "id": c.id, "version": c.version, "user_message": target, "assistant_message": assistant_msg,
            "risks": c.risks, "risk_score": c.risk_score, "citations": c.citations,
        }
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengedit pesan: {str(e)}")


@auth_router.post("/conversations/{conv_id}/messages/{message_id}/regenerate")
async def regenerate_message(
    conv_id: str,
    message_id: str,
    current: Optional[User] = Depends(get_current_user_optional),
    x_anon_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Conversation).where(
        Conversation.id == conv_id,
        _conv_access(current, x_anon_key),
    ).with_for_update()
    c = (await db.execute(stmt)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan.")

    messages = list(c.messages or [])
    idx = next((i for i, m in enumerate(messages) if m.get("id") == message_id), None)
    if idx is None or messages[idx].get("role") != "assistant":
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan.")

    try:
        target = messages[idx]
        mode = target.get("mode") or "chat"
        prev_user = next((m for m in reversed(messages[:idx]) if m.get("role") == "user"), None)
        question = prev_user.get("content") if (prev_user and mode == "chat") else None

        history = _build_history(messages[:idx], exclude_id=None)
        data, err = await _call_analyze(c.masked_text, mode, question, history)

        now_ms = _now_ms()
        prev_snapshot = {
            "content": target.get("content"), "citations": target.get("citations"),
            "actions": target.get("actions"), "sentMasked": target.get("sentMasked"),
            "receivedRaw": target.get("receivedRaw"), "mode": target.get("mode"),
            "error": target.get("error") or False, "ts": target.get("ts") or now_ms,
        }

        if err:
            new_fields = {
                "content": f"Terjadi kendala saat menganalisis dokumen: {err}. Silakan coba lagi.",
                "error": True,
            }
        else:
            reply = data.get("reply") or data.get("summary") or "Selesai."
            new_fields = {
                "content": reply, "citations": data.get("citations") or [], "actions": data.get("actions") or [],
                "sentMasked": question or MODE_LABELS.get(mode, "Analisis"), "receivedRaw": reply, "error": False,
            }
            if isinstance(data.get("risks"), list):
                c.risks = data["risks"]
            if isinstance(data.get("risk_score"), int):
                c.risk_score = data["risk_score"]
            if isinstance(data.get("citations"), list):
                c.citations = data["citations"]

        updated = {**target, **new_fields, "versions": [*(target.get("versions") or []), prev_snapshot], "ts": _now_ms()}
        messages[idx] = updated
        c.messages = messages
        c.updated_at = datetime.now(timezone.utc)
        c.version = (c.version or 0) + 1
        await db.commit()
        return {
            "id": c.id, "version": c.version, "assistant_message": updated,
            "risks": c.risks, "risk_score": c.risk_score, "citations": c.citations,
        }
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal regenerasi jawaban: {str(e)}")


@auth_router.put("/conversations/{conv_id}/mapping")
async def update_mapping(
    conv_id: str,
    body: MappingUpdateReq,
    current: Optional[User] = Depends(get_current_user_optional),
    x_anon_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Narrow, single-purpose write for the one thing the server genuinely
    can't compute itself — only the client can encrypt the PII mapping."""
    stmt = select(Conversation).where(
        Conversation.id == conv_id,
        _conv_access(current, x_anon_key),
    )
    c = (await db.execute(stmt)).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan.")

    try:
        if body.masked_text is not None:
            c.masked_text = body.masked_text
        # Same rule as everywhere else: an anonymous session has no
        # encryption key, so there is never a real mapping to store for it.
        if current and body.pii_mapping_enc is not None:
            c.pii_mapping_enc = body.pii_mapping_enc
        c.updated_at = datetime.now(timezone.utc)
        c.version = (c.version or 0) + 1
        await db.commit()
        return {"id": c.id, "version": c.version}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal memperbarui data sensor: {str(e)}")


@auth_router.get("/conversations/{conv_id}")
async def get_conversation(
    conv_id: str,
    current: Optional[User] = Depends(get_current_user_optional),
    x_anon_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    # An anonymous session restores/reconciles from the server too — same
    # source-of-truth rule as a logged-in one — so this has to work without a
    # token for an ownerless conversation. The conversation id alone is not
    # the credential though — the caller's persistent anon key must also
    # match what the row was created with.
    stmt = select(Conversation).where(
        Conversation.id == conv_id,
        _conv_access(current, x_anon_key),
    )
    res = await db.execute(stmt)
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan.")
    return {
        "id": c.id,
        "title": c.title,
        "doc_name": c.doc_name,
        "messages": c.messages or [],
        "masked_text": c.masked_text or "",
        "pii_mapping_enc": c.pii_mapping_enc or None,
        "risks": c.risks or [],
        "risk_score": c.risk_score,
        "citations": c.citations or [],
        "doc_meta": c.doc_meta or None,
        "version": c.version or 0,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@auth_router.put("/conversations/{conv_id}")
@auth_router.patch("/conversations/{conv_id}")
async def rename_conversation(
    conv_id: str,
    body: ConversationRename,
    current: Optional[User] = Depends(get_current_user_optional),
    x_anon_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Title only — everything else about a conversation changes through the
    message-action routes above or PUT /conversations/{id}/mapping, never a
    client-computed blob written wholesale here."""
    stmt = select(Conversation).where(
        Conversation.id == conv_id,
        _conv_access(current, x_anon_key),
    )
    res = await db.execute(stmt)
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan.")

    title = (body.title or "").strip()[:140]
    if not title:
        raise HTTPException(status_code=422, detail="Judul tidak boleh kosong.")

    try:
        c.title = title
        c.updated_at = datetime.now(timezone.utc)
        c.version = (c.version or 0) + 1
        await db.commit()
        return {"ok": True, "id": c.id, "title": c.title, "version": c.version}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal memperbarui percakapan: {str(e)}")


@auth_router.delete("/conversations/{conv_id}")
async def delete_conversation(
    conv_id: str,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Conversation).where(
        Conversation.id == conv_id,
        Conversation.user_id == current.id
    )
    res = await db.execute(stmt)
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan.")
    
    try:
        await db.delete(c)
        await db.commit()
        return {"ok": True, "id": conv_id}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus percakapan: {str(e)}")


# ---------- Message feedback (thumbs up/down, report) ----------
# One row per (user-or-anonymous, message): setting a new type replaces the
# previous one, which is what gives the UI its "clicking one removes the
# other" behavior. `report` is scored above `down` on the analytics side
# later — not modeled here yet, it's just another `type` value for now.
# Logged-out visitors may use these too (get_current_user_optional) — every
# conversation is now saved masked/ownerless for them too (see POST
# /conversations above), so conversation_id is populated the same way it is
# for a logged-in user; it just isn't tied to a user_id.

@auth_router.put("/messages/{message_id}/feedback")
async def set_message_feedback(
    message_id: str,
    body: FeedbackIn,
    current: Optional[User] = Depends(get_current_user_optional),
    x_anon_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if body.type not in ("up", "down", "report"):
        raise HTTPException(status_code=400, detail="Jenis masukan tidak valid.")
    if not current and not x_anon_key:
        raise HTTPException(status_code=400, detail="Kunci anonim diperlukan.")

    conv_id = body.conversation_id
    if conv_id:
        stmt = select(Conversation.id).where(
            Conversation.id == conv_id,
            _conv_access(current, x_anon_key),
        )
        if not (await db.execute(stmt)).scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan.")

    try:
        # Anonymous rows are additionally scoped by anon_key — otherwise two
        # different anonymous browsers reacting to the same message_id would
        # collide on the same row (user_id IS NULL matches both).
        stmt = select(MessageFeedback).where(
            MessageFeedback.message_id == message_id,
            _owned_by(MessageFeedback.user_id, current.id if current else None),
        )
        if not current:
            stmt = stmt.where(MessageFeedback.anon_key == x_anon_key)
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row:
            row.type = body.type
            row.conversation_id = conv_id
            row.report_reason = body.report_reason
            row.censored_excerpt = body.censored_excerpt
            row.updated_at = datetime.now(timezone.utc)
        else:
            row = MessageFeedback(
                user_id=current.id if current else None,
                anon_key=x_anon_key if not current else None,
                conversation_id=conv_id,
                message_id=message_id,
                type=body.type,
                report_reason=body.report_reason,
                censored_excerpt=body.censored_excerpt,
            )
            db.add(row)
        await db.commit()
        return {"ok": True, "message_id": message_id, "type": row.type}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan masukan: {str(e)}")


@auth_router.delete("/messages/{message_id}/feedback")
async def clear_message_feedback(
    message_id: str,
    current: Optional[User] = Depends(get_current_user_optional),
    x_anon_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not current and not x_anon_key:
        raise HTTPException(status_code=400, detail="Kunci anonim diperlukan.")
    try:
        stmt = select(MessageFeedback).where(
            MessageFeedback.message_id == message_id,
            _owned_by(MessageFeedback.user_id, current.id if current else None),
        )
        if not current:
            stmt = stmt.where(MessageFeedback.anon_key == x_anon_key)
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row:
            await db.delete(row)
            await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus masukan: {str(e)}")


@auth_router.get("/conversations/{conv_id}/feedback")
async def list_conversation_feedback(
    conv_id: str,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Conversation.id).where(
        Conversation.id == conv_id,
        Conversation.user_id == current.id
    )
    if not (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan.")

    rows = (await db.execute(
        select(MessageFeedback.message_id, MessageFeedback.type).where(
            MessageFeedback.conversation_id == conv_id,
            MessageFeedback.user_id == current.id,
        )
    )).all()
    return {message_id: fb_type for message_id, fb_type in rows}
