"""
PasalBerapa? — Klien pasal.id (live legal search API)
======================================================
Index ChromaDB lokal (ingest.py) tidak pernah terisi — repo sumber data
(Open-Technology-Foundation/peraturan.go.id) sudah inactive & tidak pernah
benar-benar mempublikasikan korpus embed_data.text-nya. Ganti pencarian
pasal dengan panggilan live ke pasal.id (https://pasal.id/api).

Butuh PASAL_API_TOKENS — satu atau lebih token (pisahkan dgn koma), akun
gratis di https://pasal.id/akun. Kalau lebih dari satu token diberikan,
request di-rotasi round-robin antar token utk menyebar rate limit
(60 req/menit per token), dan otomatis lompat ke token berikutnya kalau
salah satu kena HTTP 429.
"""
import os
import logging
import threading
import itertools
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("pasalberapa.pasal_client")

PASAL_API_BASE = os.environ.get("PASAL_API_BASE", "https://pasal.id/api/v1").rstrip("/")
PASAL_API_TOKENS: List[str] = [
    t.strip() for t in os.environ.get("PASAL_API_TOKENS", "").split(",") if t.strip()
]
PASAL_TIMEOUT = float(os.environ.get("PASAL_TIMEOUT", "15"))

_token_lock = threading.Lock()
_token_cycle = itertools.cycle(PASAL_API_TOKENS) if PASAL_API_TOKENS else None


def is_configured() -> bool:
    return bool(PASAL_API_TOKENS)


def _next_token() -> Optional[str]:
    if not _token_cycle:
        return None
    with _token_lock:
        return next(_token_cycle)


def _format_regulation(work: Dict[str, Any]) -> str:
    type_, number, year, title = work.get("type") or "", work.get("number") or "", work.get("year") or "", work.get("title") or ""
    head = f"{type_} No. {number} Tahun {year}".strip() if (type_ or number or year) else ""
    if head and title:
        return f"{head} tentang {title}"
    return head or title or "Peraturan"


def search(query: str, regulation: Optional[str] = None, top_k: int = 6) -> List[Dict[str, Any]]:
    """Cari pasal via pasal.id. Kembalikan list {regulation, article, snippet, url, score}
    — bentuk yang sama dengan hasil retriever.search() lama, supaya kode di hilir
    (penggabungan citations, normalisasi respons, render frontend) tidak perlu berubah."""
    if not is_configured():
        logger.warning("[pasal] PASAL_API_TOKENS belum diset — skip pencarian live.")
        return []

    q = f"{regulation} {query}".strip() if regulation else (query or "").strip()
    if not q:
        return []
    n = max(1, min(int(top_k), 20))

    data = None
    for attempt in range(len(PASAL_API_TOKENS)):
        token = _next_token()
        try:
            with httpx.Client(timeout=PASAL_TIMEOUT) as client:
                resp = client.get(
                    f"{PASAL_API_BASE}/search",
                    params={"q": q, "limit": n},
                    headers={"Authorization": f"Bearer {token}"},
                )
        except Exception as e:
            logger.warning("[pasal] request error: %s", e)
            return []

        if resp.status_code == 429:
            logger.warning("[pasal] token #%d kena rate limit, coba token berikutnya...", attempt + 1)
            continue
        if resp.status_code != 200:
            logger.warning("[pasal] search gagal HTTP %s: %s", resp.status_code, resp.text[:200])
            return []
        data = resp.json()
        break
    else:
        logger.warning("[pasal] semua token (%d) kena rate limit.", len(PASAL_API_TOKENS))
        return []

    out: List[Dict[str, Any]] = []
    for item in data.get("results") or []:
        work = item.get("work") or {}
        best = item.get("best_passage") or {}
        href = best.get("href") or work.get("frbr_uri") or ""
        url = f"https://pasal.id{href}" if href else ""
        article = best.get("pasal_label") or ", ".join(item.get("matching_pasals") or [])
        out.append({
            "regulation": _format_regulation(work),
            "article": article,
            "snippet": item.get("snippet", ""),
            "url": url,
            "score": item.get("score"),
        })
    return out
