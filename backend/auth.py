"""
PasalBerapa? — Auth + Saved Conversations (PostgreSQL).
Anonymous by default. Users may register ONLY to save their chats.
Email/password + JWT (bcrypt hashing). Stored in PostgreSQL with JSONB messages.
"""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db, User, Conversation

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


class ConversationIn(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    messages: List[Dict[str, Any]] = []
    doc_name: Optional[str] = None
    masked_text: Optional[str] = None
    # base64(iv ‖ AES-GCM ciphertext). Opaque to the server, by design.
    pii_mapping_enc: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None
    masked_text: Optional[str] = None
    pii_mapping_enc: Optional[str] = None


# ---------- Helpers ----------
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
    current.password_hash = _hash_pw(req.auth_secret)
    current.kdf_version = CURRENT_KDF
    await db.commit()
    return {"kdf_version": current.kdf_version}


@auth_router.get("/auth/me")
async def me(current: User = Depends(get_current_user)):
    return {"user": _public_user(current)}


# ---------- Conversations (private per user) ----------
def _conv_summary(c: Conversation) -> dict:
    return {
        "id": c.id,
        "title": c.title or "Percakapan",
        "doc_name": c.doc_name,
        "count": len(c.messages) if isinstance(c.messages, list) else 0,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


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


@auth_router.post("/conversations")
async def save_or_upsert_conversation(
    body: ConversationIn,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    raw_title = body.title or (body.doc_name or "Percakapan")
    clean_title = raw_title.strip()[:140] if raw_title else "Percakapan"

    try:
        # Check if conversation already exists (upsert)
        if body.id:
            stmt = select(Conversation).where(
                Conversation.id == body.id,
                Conversation.user_id == current.id
            )
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()
            if existing:
                existing.title = clean_title
                existing.messages = body.messages
                if body.masked_text is not None:
                    existing.masked_text = body.masked_text
                if body.pii_mapping_enc is not None:
                    existing.pii_mapping_enc = body.pii_mapping_enc
                if body.doc_name:
                    existing.doc_name = body.doc_name
                existing.updated_at = now
                await db.commit()
                return {
                    "id": existing.id,
                    "title": existing.title,
                    "updated_at": existing.updated_at.isoformat()
                }

        conv_id = body.id or str(uuid.uuid4())
        conv = Conversation(
            id=conv_id,
            user_id=current.id,
            title=clean_title,
            doc_name=body.doc_name,
            messages=body.messages,
            masked_text=body.masked_text,
            pii_mapping_enc=body.pii_mapping_enc,
            created_at=now,
            updated_at=now
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        return {
            "id": conv.id,
            "title": conv.title,
            "updated_at": conv.updated_at.isoformat()
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan percakapan: {str(e)}")


@auth_router.get("/conversations/{conv_id}")
async def get_conversation(
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
    return {
        "id": c.id,
        "title": c.title,
        "doc_name": c.doc_name,
        "messages": c.messages or [],
        "masked_text": c.masked_text or "",
        "pii_mapping_enc": c.pii_mapping_enc or None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@auth_router.put("/conversations/{conv_id}")
@auth_router.patch("/conversations/{conv_id}")
async def update_conversation(
    conv_id: str,
    body: ConversationUpdate,
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
        if body.title is not None:
            c.title = body.title.strip()[:140]
        if body.messages is not None:
            c.messages = body.messages
        if body.masked_text is not None:
            c.masked_text = body.masked_text
        if body.pii_mapping_enc is not None:
            c.pii_mapping_enc = body.pii_mapping_enc
        c.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        return {"ok": True, "id": c.id, "title": c.title}
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
