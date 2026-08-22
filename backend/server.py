"""
PasalBerapa? — Backend Hub Server
==================================
Layanan API otentikasi, penyimpanan riwayat percakapan privat, dan proxy router (PostgreSQL).
"""
import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from database import init_db, close_db
from auth import auth_router
from pasalberapa_ref import ref_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("pasalberapa.backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize PostgreSQL tables
    logger.info("Starting PasalBerapa Backend Server...")
    await init_db()
    yield
    # Shutdown: cleanly close database connection
    logger.info("Shutting down PasalBerapa Backend Server...")
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

app.include_router(api_router)
app.include_router(auth_router)
app.include_router(ref_router)
