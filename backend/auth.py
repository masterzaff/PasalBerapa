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
class RegisterReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class ConversationIn(BaseModel):
    title: Optional[str] = None
    messages: List[Dict[str, Any]] = []
    doc_name: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None


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
        raise HTTPException(status_code=401, detail="Butuh login dulu.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi login habis, silakan masuk lagi.")
    except Exception:
        raise HTTPException(status_code=401, detail="Token nggak valid.")

    user_id = payload.get("sub")
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=401, detail="User nggak ditemukan.")
    return u


# ---------- Auth routes ----------
@auth_router.post("/auth/register")
async def register(req: RegisterReq, db: AsyncSession = Depends(get_db)):
    email = req.email.lower().strip()
    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email ini udah kedaftar. Coba login.")
    
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        name=req.name,
        password_hash=_hash_pw(req.password),
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"token": _make_token(user.id), "user": _public_user(user)}


@auth_router.post("/auth/login")
async def login(req: LoginReq, db: AsyncSession = Depends(get_db)):
    email = req.email.lower().strip()
    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    u = res.scalar_one_or_none()
    if not u or not _verify_pw(req.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Email atau password salah.")
    return {"token": _make_token(u.id), "user": _public_user(u)}


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
async def save_conversation(
    body: ConversationIn,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    title = body.title or (body.doc_name or "Percakapan")
    conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=current.id,
        title=title[:120],
        doc_name=body.doc_name,
        messages=body.messages,
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
        raise HTTPException(status_code=404, detail="Percakapan nggak ketemu.")
    return {
        "id": c.id,
        "title": c.title,
        "doc_name": c.doc_name,
        "messages": c.messages or [],
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@auth_router.put("/conversations/{conv_id}")
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
        raise HTTPException(status_code=404, detail="Percakapan nggak ketemu.")
    
    if body.title is not None:
        c.title = body.title[:120]
    if body.messages is not None:
        c.messages = body.messages
    c.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    return {"ok": True, "title": c.title}


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
        raise HTTPException(status_code=404, detail="Percakapan nggak ketemu.")
    
    await db.delete(c)
    await db.commit()
    return {"ok": True}
