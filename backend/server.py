import logging
import os
from pathlib import Path
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException
from starlette.middleware.cors import CORSMiddleware

import ai_client
from database import init_db, close_db
from auth import auth_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("pasalberapa.backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize PostgreSQL tables & AI Node reverse proxy client
    logger.info("Starting PasalBerapa Backend Server...")
    await init_db()
    await ai_client.start()
    yield
    # Shutdown: cleanly close database & HTTP client
    logger.info("Shutting down PasalBerapa Backend Server...")
    await ai_client.stop()
    await close_db()

app = FastAPI(
    title="PasalBerapa? Backend Hub",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    import time
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response

# API Root & Health Router
api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def api_root():
    return {
        "service": "pasalberapa-backend",
        "database": "postgresql",
        "status": "online",
        "version": "1.0.0"
    }

@api_router.get("/health")
async def health_check():
    ai_status = "offline"
    ai_detail = None
    if ai_client.client:
        try:
            res = await ai_client.client.get("/health", timeout=3.0)
            if res.status_code == 200:
                ai_status = "online"
                ai_detail = res.json()
        except Exception:
            pass
    return {
        "status": "ok",
        "service": "pasalberapa-backend",
        "database": "postgresql",
        "ai_node": ai_status,
        "ai_detail": ai_detail,
        "version": "1.0.0"
    }

# ---------------------------------------------------------------------------
# AI Node Reverse Proxy (PII Masking & Legal RAG / LLM Analysis)
# ---------------------------------------------------------------------------
@api_router.post("/mask")
async def proxy_mask(request: Request):
    if not ai_client.client:
        raise HTTPException(status_code=503, detail="AI Service client belum diinisialisasi")
    try:
        body = await request.json()
        res = await ai_client.client.post("/mask", json=body, timeout=30.0)
        return Response(content=res.content, status_code=res.status_code, media_type="application/json")
    except (httpx.ConnectError, httpx.ConnectTimeout):
        raise HTTPException(status_code=503, detail="AI Node sedang offline atau belum siap")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI Node timeout saat memindai PII")
    except Exception as e:
        logger.error(f"Error proxying /mask: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/analyze")
async def proxy_analyze(request: Request):
    if not ai_client.client:
        raise HTTPException(status_code=503, detail="AI Service client belum diinisialisasi")
    try:
        body = await request.json()
        res = await ai_client.client.post("/analyze", json=body, timeout=90.0)
        return Response(content=res.content, status_code=res.status_code, media_type="application/json")
    except (httpx.ConnectError, httpx.ConnectTimeout):
        raise HTTPException(status_code=503, detail="AI Node sedang offline atau belum siap")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI Node timeout saat menganalisis dokumen")
    except Exception as e:
        logger.error(f"Error proxying /analyze: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# The /search proxy is gone with the AI node's endpoint: it fronted the local
# ChromaDB index, which had been dead since its upstream dataset disappeared.
# Legal lookup now happens inside /analyze via the pasal.id tool call.

app.include_router(api_router)
app.include_router(auth_router)
