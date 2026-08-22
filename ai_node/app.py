"""
PasalBerapa? — AI Node (RAG + PII Masking + LLM)
================================================
FastAPI server yang menjalankan seluruh "otak" PasalBerapa? di server-mu sendiri
(privacy-first: frontend hanya wrapper). Sesuai `API_CONTRACT.md`:

    GET  /health   -> liveness + status index/LLM
    POST /mask     -> redaksi PII (Presidio + regex Indonesia)
    POST /analyze  -> RAG (ChromaDB) + LLM (OpenAI-compatible) -> analisis terstruktur
    POST /search   -> debug retrieval mentah (opsional)

Konfigurasi via ENV (lihat .env.example). Kredensial LLM TIDAK di-hardcode.
"""
import os
import logging
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import masker
import retriever
import prompts
import llm

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("pasalberapa.app")

VERSION = "1.0.0"
TOP_K_DEFAULT = int(os.environ.get("TOP_K_DEFAULT", "6"))
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

app = FastAPI(title="PasalBerapa AI Node", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------- Models ---------------------------
class MaskReq(BaseModel):
    text: str
    session_id: Optional[str] = None


class SearchReq(BaseModel):
    query: str
    top_k: int = TOP_K_DEFAULT


class AnalyzeReq(BaseModel):
    masked_text: str = ""
    mode: str = "chat"  # chat | summary | risk | key_articles
    question: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None
    session_id: Optional[str] = None
    top_k: int = TOP_K_DEFAULT


# --------------------------- Routes ---------------------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "pasalberapa-ai-node",
        "version": VERSION,
        "indexed_chunks": retriever.count(),
        "embed_model": retriever.EMBED_MODEL,
        "pii_engine": masker.engine_name(),
        "llm": llm.status(),
    }


@app.post("/mask")
async def mask(req: MaskReq):
    masked_text, mapping, entities = masker.mask_text(req.text or "")
    return {"masked_text": masked_text, "mapping": mapping, "entities": entities}


@app.post("/search")
async def search(req: SearchReq):
    results = retriever.search(req.query, req.top_k)
    if not results:
        return {"results": [], "note": "Index kosong / tidak ada hasil — jalankan ingest.py."}
    return {"results": results}


def _build_rag_query(req: AnalyzeReq) -> str:
    if req.mode == "chat" and req.question:
        return req.question
    # untuk mode dokumen, pakai potongan awal dokumen + pertanyaan (bila ada)
    base = (req.question or "") + " " + (req.masked_text or "")[:1500]
    return base.strip()


@app.post("/analyze")
async def analyze(req: AnalyzeReq):
    if not llm.is_configured():
        raise HTTPException(
            status_code=503,
            detail="LLM belum dikonfigurasi di AI Node. Set LLM_BASE_URL & LLM_API_KEY.",
        )

    # 1) RAG retrieval (best-effort; kegagalan retrieval tidak boleh mematikan analisis)
    citations: List[Dict] = []
    try:
        rag_query = _build_rag_query(req)
        citations = retriever.search(rag_query, req.top_k)
    except Exception as e:
        logger.warning("[analyze] retrieval gagal, lanjut tanpa RAG: %s", e)

    # 2) Susun prompt & panggil LLM
    messages = prompts.build_messages(
        masked_text=req.masked_text,
        mode=req.mode,
        question=req.question,
        history=req.history,
        citations=citations,
    )
    try:
        parsed = llm.chat_json(messages)
    except llm.LLMNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except llm.LLMError as e:
        raise HTTPException(status_code=502, detail=f"Gagal memanggil LLM: {e}")

    # 3) Normalisasi output agar selalu sesuai kontrak
    return _normalize(parsed, req.mode, citations)


def _normalize(parsed: Dict[str, Any], mode: str, citations: List[Dict]) -> Dict[str, Any]:
    reply = parsed.get("reply") or parsed.get("summary") or ""
    risks = parsed.get("risks") if isinstance(parsed.get("risks"), list) else []

    # rapikan tiap risk agar field lengkap
    norm_risks = []
    for i, r in enumerate(risks, 1):
        if not isinstance(r, dict):
            continue
        level = str(r.get("level", "warning")).lower()
        if level not in ("high", "warning", "safe"):
            level = "warning"
        refs = r.get("article_refs")
        if isinstance(refs, str):
            refs = [refs]
        norm_risks.append({
            "id": r.get("id") or f"r{i}",
            "level": level,
            "title": r.get("title", "Poin perlu diperhatikan"),
            "explanation": r.get("explanation", ""),
            "article_refs": refs or [],
            "suggestion": r.get("suggestion", ""),
            "source_excerpt": r.get("source_excerpt", ""),
        })

    # risk_score: pakai dari model bila ada & valid, kalau tidak hitung heuristik
    score = parsed.get("risk_score")
    try:
        score = int(score) if score is not None else None
    except (ValueError, TypeError):
        score = None
    if score is None and mode == "risk":
        highs = sum(1 for r in norm_risks if r["level"] == "high")
        warns = sum(1 for r in norm_risks if r["level"] == "warning")
        score = min(100, highs * 28 + warns * 12)

    # citations: gabungkan yang dari model + hasil RAG (RAG sebagai sumber kebenaran)
    model_cites = parsed.get("citations") if isinstance(parsed.get("citations"), list) else []
    merged_cites = citations if citations else model_cites

    return {
        "reply": reply,
        "summary": parsed.get("summary"),
        "risk_score": score,
        "risks": norm_risks,
        "citations": merged_cites,
        "engine": f"ai-node/{VERSION} ({masker.engine_name()} + RAG + LLM:{llm.LLM_MODEL})",
    }
