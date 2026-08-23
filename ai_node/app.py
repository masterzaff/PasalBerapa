"""
PasalBerapa? — AI Node (RAG + PII Masking + LLM)
================================================
FastAPI server yang menjalankan seluruh "otak" PasalBerapa? di server-mu sendiri
(privacy-first: frontend hanya wrapper). Sesuai `API_CONTRACT.md`:

    GET  /health   -> liveness + status index/LLM
    POST /mask     -> redaksi PII (NER Indonesia + regex)
    POST /analyze  -> LLM (OpenAI-compatible) + tool calling -> analisis terstruktur

Konfigurasi via ENV (lihat .env.example). Kredensial LLM TIDAK di-hardcode.
"""
import os
import logging
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import masker
import prompts
import llm
import tools
import pasal_client

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
    # Mapping yang sudah berjalan di sesi ini. Dikirim saat menyensor pertanyaan
    # chat supaya nilai yang sudah punya tag memakai tag yang sama dan penomoran
    # tag baru menyambung — bukan mengulang dari _1 dan bertabrakan dgn dokumen.
    known_mapping: Optional[Dict[str, str]] = None


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
    ner = masker.ner_status()
    return {
        # "degraded" kalau NER mati: regex tetap jalan tapi NAMA tidak tersensor.
        "status": "ok" if ner["ok"] else "degraded",
        "service": "pasalberapa-ai-node",
        "version": VERSION,
        "pii_engine": masker.engine_name(),
        "pii_ner": ner,
        "llm": llm.status(),
        "pasal_id_configured": pasal_client.is_configured(),
        "pasal_id_tokens": len(pasal_client.PASAL_API_TOKENS),
    }


@app.post("/mask")
async def mask(req: MaskReq):
    """Redaksi PII.

    PENTING — JANGAN PERNAH me-log `req.text`, `mapping`, atau `entities`.
    Endpoint ini menerima dokumen MENTAH (nama, NIK, alamat asli): node memang
    harus membacanya untuk bisa menyensor, dan itu satu-satunya titik di sistem
    yang melihat PII apa adanya. Selebihnya — DB, LLM, log — tidak boleh. Menulis
    isinya ke log akan diam-diam membatalkan seluruh desain privasi ini.
    """
    masked_text, mapping, new_entities = masker.mask_text(
        req.text or "", known_mapping=req.known_mapping
    )
    return {
        "masked_text": masked_text,
        "mapping": mapping,
        "entities": new_entities,
    }


@app.post("/analyze")
async def analyze(req: AnalyzeReq):
    if not llm.is_configured():
        raise HTTPException(
            status_code=503,
            detail="LLM belum dikonfigurasi di AI Node. Set LLM_BASE_URL & LLM_API_KEY.",
        )

    doc_lines = (req.masked_text or "").splitlines()

    # Dynamic tool executor callback for Agentic ReAct loop
    def execute_tool(name: str, args: Dict[str, Any]) -> Any:
        try:
            if name == "search_indonesian_law":
                q = args.get("query") or ""
                reg = args.get("regulation")
                return tools.execute_search_law(q, regulation=reg, top_k=req.top_k)
            elif name == "search_user_document":
                q = args.get("query") or ""
                return tools.execute_search_user_doc(q, doc_lines=doc_lines)
            elif name == "read_document_lines":
                s_line = int(args.get("start_line", 1))
                e_line = int(args.get("end_line", s_line + 30))
                return tools.execute_read_lines(s_line, e_line, doc_lines=doc_lines)
            return {"error": f"Tool '{name}' tidak dikenal."}
        except Exception as e:
            logger.exception("[tool] '%s' gagal dieksekusi: %s", name, e)
            return {"error": f"Tool '{name}' gagal dieksekusi: {e}"}

    # 1) Susun prompt awal (LLM otonom memutuskan apakah perlu memanggil tool atau langsung menjawab)
    messages = prompts.build_messages(
        masked_text=req.masked_text,
        mode=req.mode,
        question=req.question,
        history=req.history,
    )

    # 2) Jalankan Agentic ReAct Tool Calling loop
    try:
        parsed, citations, actions, debug_messages = llm.chat_agentic(
            messages=messages,
            tools=tools.LEGAL_TOOLS_SCHEMA,
            tool_executor=execute_tool,
            max_steps=3,
            mode=req.mode,
        )
    except llm.LLMNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except llm.LLMError as e:
        raise HTTPException(status_code=502, detail=f"Gagal memanggil LLM: {e}")

    # 3) Normalisasi output agar selalu sesuai kontrak
    return _normalize(parsed, req.mode, citations, actions, debug_messages)


def _normalize(
    parsed: Dict[str, Any],
    mode: str,
    citations: List[Dict],
    actions: List[Dict[str, Any]] = None,
    debug_messages: List[Dict[str, Any]] = None,
) -> Dict[str, Any]:
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
        "actions": actions or [],
        "debug": {"llm_messages": debug_messages or []},
        "engine": f"ai-node/{VERSION} ({masker.engine_name()} + RAG + LLM:{llm.LLM_MODEL})",
    }
