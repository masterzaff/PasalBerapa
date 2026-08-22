"""
PasalBerapa? — REFERENCE CONTRACT STUB (for local validation / demo only)
=========================================================================
This is NOT the production AI node. It implements the exact API contract in
`/app/ai_node/API_CONTRACT.md` using simple regex masking + deterministic,
template-based analysis (NO LLM, NO Vector DB). Its only purpose is to let the
frontend wrapper be validated end-to-end (mask -> analyze -> unmask -> dashboard).

Replace this with your own hosted AI node (model-based PII masking + RAG + LLM).
Endpoints exposed (under /api):
    GET  /api/health
    POST /api/mask       (PII masking)
    POST /api/analyze    (RAG + LLM analysis, here templated)
"""
import re
from typing import List, Optional, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel

ref_router = APIRouter(prefix="/api")


# ---------- Models ----------
class MaskRequest(BaseModel):
    text: str
    session_id: Optional[str] = None


class AnalyzeRequest(BaseModel):
    masked_text: str
    mode: str = "chat"
    question: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None
    session_id: Optional[str] = None


# ---------- Regex-based PII masker (reference only) ----------
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
NIK_RE = re.compile(r"\b\d{16}\b")
PHONE_RE = re.compile(r"\b(?:\+62|62|0)8[1-9][0-9]{6,11}\b")
NPWP_RE = re.compile(r"\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b")
MONEY_RE = re.compile(r"Rp\s?\d[\d.\,]*", re.IGNORECASE)
ADDRESS_RE = re.compile(r"\b(?:Jl\.?|Jalan)\s+[^,\n.]{3,60}", re.IGNORECASE)
# Heuristic Indonesian name: 2-3 capitalized words (after cleaning known stopwords)
NAME_RE = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b")

NAME_STOPWORDS = {
    "Pihak Pertama", "Pihak Kedua", "Surat Perjanjian", "Perjanjian Kerja",
    "Waktu Tertentu", "Masa Kerja", "Hubungan Kerja", "Jakarta Selatan",
    "Surat Perjanjian Sewa", "Yang Bertanda", "Bertanda Tangan",
}


def _mask(text: str):
    mapping: Dict[str, str] = {}
    entities: List[Dict[str, str]] = []
    counters: Dict[str, int] = {}
    value_to_tag: Dict[str, str] = {}

    def make_tag(kind: str, value: str) -> str:
        value = value.strip()
        if value in value_to_tag:
            return value_to_tag[value]
        counters[kind] = counters.get(kind, 0) + 1
        tag = f"<{kind}_{counters[kind]}>"
        mapping[tag] = value
        value_to_tag[value] = tag
        entities.append({"tag": tag, "type": kind, "value": value})
        return tag

    # Order matters: mask specific patterns before generic name heuristic.
    def sub(pattern, kind, s):
        return pattern.sub(lambda m: make_tag(kind, m.group(0)), s)

    masked = text
    masked = sub(EMAIL_RE, "EMAIL", masked)
    masked = sub(NPWP_RE, "NPWP", masked)
    masked = sub(NIK_RE, "NIK", masked)
    masked = sub(PHONE_RE, "PHONE", masked)
    masked = sub(MONEY_RE, "MONEY", masked)
    masked = sub(ADDRESS_RE, "ADDRESS", masked)

    def name_repl(m):
        val = m.group(1)
        if val in NAME_STOPWORDS:
            return val
        # skip if this looks like a sentence start heading (all-caps handled elsewhere)
        return make_tag("PERSON", val)

    masked = NAME_RE.sub(name_repl, masked)
    return masked, mapping, entities


# ---------- Templated analysis (reference only) ----------
RED_FLAG_RULES = [
    ("denda", "high", "Ada klausul denda", "Dokumen menyebut denda/penalti yang bisa membebani kamu.", ["Pasal 1338 KUHPerdata"], "Cek besaran denda & minta diturunkan atau dihapus saat negosiasi."),
    ("penalti", "high", "Penalti sepihak", "Ada penalti yang berat sebelah. Ini merugikan pihak yang lebih lemah.", ["Pasal 1320 KUHPerdata"], "Minta klausul penalti dibuat proporsional dan dua arah."),
    ("sepihak", "high", "Keputusan sepihak", "Salah satu pihak bisa mengambil keputusan sepihak tanpa persetujuan.", ["Pasal 1266 KUHPerdata"], "Tambahkan syarat pemberitahuan & persetujuan bersama."),
    ("tanpa pesangon", "high", "PHK tanpa pesangon", "Pemutusan hubungan kerja tanpa pesangon berpotensi melanggar hak pekerja.", ["Pasal 156 UU Ketenagakerjaan"], "Pastikan hak pesangon sesuai UU tetap diberikan."),
    ("hangus", "warning", "Deposit bisa hangus", "Ada ketentuan uang/deposit yang bisa hangus. Perhatikan syaratnya.", ["Pasal 1338 KUHPerdata"], "Minta syarat 'hangus' diperjelas & diberi tenggang waktu."),
    ("kerahasiaan", "safe", "Klausul kerahasiaan", "Klausul kerahasiaan itu wajar untuk melindungi kedua pihak.", [], "Pastikan lingkup & jangka waktunya wajar."),
    ("dilarang", "warning", "Larangan tertentu", "Ada larangan yang perlu kamu pahami konsekuensinya.", [], "Baca ulang bagian ini biar nggak kejebak."),
]


def _excerpt_for(keyword: str, text: str) -> str:
    idx = text.lower().find(keyword.lower())
    if idx == -1:
        return ""
    start = max(0, idx - 40)
    end = min(len(text), idx + 90)
    return text[start:end].strip()


def _first_person_tag(text: str) -> str:
    m = re.search(r"<PERSON_\d+>", text)
    return m.group(0) if m else "pihak dalam dokumen ini"


def _analyze(req: AnalyzeRequest):
    text = req.masked_text or ""
    subject = _first_person_tag(text)
    risks = []
    seen = set()
    for kw, level, title, expl, refs, sugg in RED_FLAG_RULES:
        if kw in text.lower() and title not in seen:
            seen.add(title)
            risks.append({
                "id": f"risk_{len(risks)+1}",
                "level": level,
                "title": title,
                "explanation": expl,
                "article_refs": refs,
                "suggestion": sugg,
                "source_excerpt": _excerpt_for(kw, text),
            })

    highs = sum(1 for r in risks if r["level"] == "high")
    warns = sum(1 for r in risks if r["level"] == "warning")
    score = min(100, highs * 28 + warns * 12)

    if req.mode == "summary":
        reply = (
            f"Oke, ringkasan singkatnya ya. Dokumen ini pada dasarnya ngatur hubungan "
            f"antara {subject} dan pihak lain. Poin utamanya: kewajiban, hak, dan "
            f"konsekuensi kalau ada yang dilanggar. Aku nemu {len(risks)} poin yang "
            f"perlu kamu perhatiin (lihat Dashboard Risiko di kanan)."
        )
    elif req.mode == "key_articles":
        reply = (
            "Pasal-pasal yang paling penting buat kamu perhatiin:\n"
            "1. Bagian soal kewajiban utama & jangka waktu.\n"
            "2. Bagian sanksi/denda kalau melanggar.\n"
            "3. Bagian pemutusan/pengakhiran perjanjian.\n"
            "Secara hukum, keabsahan perjanjian mengacu pada Pasal 1320 KUHPerdata "
            "(syarat sahnya perjanjian)."
        )
    elif req.mode == "risk":
        if risks:
            reply = (
                f"Nih hasil bedah risikonya. Aku nemu {len(risks)} poin "
                f"({highs} tinggi, {warns} peringatan). Yang paling perlu kamu waspadai "
                f"udah aku taruh di Dashboard Risiko sebelah kanan — klik kartunya buat "
                f"lihat kutipan & saran negosiasinya."
            )
        else:
            reply = "Kabar baik: aku nggak nemu red flag mencolok di dokumen ini. Tetap baca teliti ya."
    else:  # chat
        q = (req.question or "").strip()
        reply = (
            f"Soal '{q}' — berdasarkan dokumen ini, jawabannya tergantung klausul yang "
            f"berlaku buat {subject}. Secara umum, perhatiin bagian kewajiban & sanksi. "
            f"Kalau ada denda/penalti, itu yang biasanya bikin repot. Mau aku bedah "
            f"risikonya sekalian?"
        )

    return {
        "reply": reply,
        "summary": reply if req.mode == "summary" else None,
        "risk_score": score if req.mode == "risk" else None,
        "risks": risks if req.mode == "risk" else [],
        "citations": [
            {
                "regulation": "KUH Perdata",
                "article": "Pasal 1320",
                "snippet": "Syarat sahnya suatu perjanjian.",
                "url": "https://peraturan.go.id/",
            }
        ] if req.mode in ("risk", "key_articles") else [],
        "engine": "reference-stub",
    }


# ---------- Routes ----------
@ref_router.get("/health")
async def ref_health():
    return {"status": "ok", "service": "pasalberapa-reference-stub", "version": "1.0.0"}


@ref_router.post("/mask")
async def ref_mask(req: MaskRequest):
    masked, mapping, entities = _mask(req.text or "")
    return {"masked_text": masked, "mapping": mapping, "entities": entities}


@ref_router.post("/analyze")
async def ref_analyze(req: AnalyzeRequest):
    return _analyze(req)
