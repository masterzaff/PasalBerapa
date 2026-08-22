"""
PasalBerapa? — Klien pasal.id (live legal search API)
======================================================
Index ChromaDB lokal (ingest.py) tidak pernah terisi — repo sumber data
(Open-Technology-Foundation/peraturan.go.id) sudah inactive & tidak pernah
benar-benar mempublikasikan korpus embed_data.text-nya. Ganti pencarian
pasal dengan panggilan live ke pasal.id (https://pasal.id/api).

Butuh PASAL_API_TOKEN (akun gratis di https://pasal.id/akun).
"""
import os
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("pasalberapa.pasal_client")

PASAL_API_BASE = os.environ.get("PASAL_API_BASE", "https://pasal.id/api/v1").rstrip("/")
PASAL_API_TOKEN = os.environ.get("PASAL_API_TOKEN", "")
PASAL_TIMEOUT = float(os.environ.get("PASAL_TIMEOUT", "15"))


def is_configured() -> bool:
    return bool(PASAL_API_TOKEN)


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
        logger.warning("[pasal] PASAL_API_TOKEN belum diset — skip pencarian live.")
        return []

    q = f"{regulation} {query}".strip() if regulation else (query or "").strip()
    if not q:
        return []
    n = max(1, min(int(top_k), 20))

    try:
        with httpx.Client(timeout=PASAL_TIMEOUT) as client:
            resp = client.get(
                f"{PASAL_API_BASE}/search",
                params={"q": q, "limit": n},
                headers={"Authorization": f"Bearer {PASAL_API_TOKEN}"},
            )
        if resp.status_code != 200:
            logger.warning("[pasal] search gagal HTTP %s: %s", resp.status_code, resp.text[:200])
            return []
        data = resp.json()
    except Exception as e:
        logger.warning("[pasal] request error: %s", e)
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
