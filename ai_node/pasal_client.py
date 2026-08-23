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


import re

def search(query: str, regulation: Optional[str] = None, top_k: int = 6) -> List[Dict[str, Any]]:
    """Cari pasal via pasal.id. Kembalikan list {regulation, article, snippet, url, score, frbr_uri}
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
        frbr = (work.get("frbr_uri") or "").lstrip("/")
        out.append({
            "regulation": _format_regulation(work),
            "article": article,
            "snippet": item.get("snippet", ""),
            "url": url,
            "score": item.get("score"),
            "frbr_uri": frbr,
        })
    return out


def resolve_frbr_and_pasal(identifier: str, pasal: Optional[str] = None) -> tuple[str, Optional[str]]:
    """Mengekstrak FRBR URI dan nomor pasal dari identifier fleksibel (FRBR URI, URL pasal.id, atau nama hukum)."""
    ident = (identifier or "").strip()
    target_pasal = str(pasal).strip() if pasal else None

    # Jika URL memuat anchor atau path pasal (contoh: /pasal-89 atau #node-...)
    m_pasal_url = re.search(r"pasal[_-]?(\d+[a-z]?)", ident, re.IGNORECASE)
    if m_pasal_url and not target_pasal:
        target_pasal = m_pasal_url.group(1)

    # 1. Cek jika identifier memuat pola FRBR URI langsung (akn/...)
    m_akn = re.search(r"akn/[a-zA-Z0-9/_.-]+", ident)
    if m_akn:
        return m_akn.group(0).lstrip("/"), target_pasal

    # 2. Jika merupakan URL web pasal.id atau nama peraturan, bersihkan & cari FRBR URI
    clean_q = re.sub(r"https?://(?:www\.)?pasal\.id/(?:peraturan/)?", "", ident)
    clean_q = re.sub(r"#.*$", "", clean_q).replace("-", " ").replace("/", " ").strip()

    search_res = search(clean_q or ident, top_k=1)
    if search_res and search_res[0].get("frbr_uri"):
        return search_res[0]["frbr_uri"], target_pasal

    return ident.lstrip("/"), target_pasal


def get_law_detail(frbr_uri: str) -> Optional[Dict[str, Any]]:
    """Mengambil metadata dan seluruh artikel peraturan via GET /api/v1/laws/{frbr_uri}."""
    if not is_configured():
        return None

    clean_path = frbr_uri.lstrip("/")
    for attempt in range(len(PASAL_API_TOKENS)):
        token = _next_token()
        try:
            with httpx.Client(timeout=PASAL_TIMEOUT) as client:
                resp = client.get(
                    f"{PASAL_API_BASE}/laws/{clean_path}",
                    headers={"Authorization": f"Bearer {token}"},
                )
        except Exception as e:
            logger.warning("[pasal] get_law_detail request error: %s", e)
            return None

        if resp.status_code == 429:
            logger.warning("[pasal] token #%d kena rate limit, coba token berikutnya...", attempt + 1)
            continue
        if resp.status_code != 200:
            logger.warning("[pasal] get_law_detail gagal HTTP %s: %s", resp.status_code, resp.text[:200])
            return None
        return resp.json()
    return None


def read_law_content(
    identifier: str,
    pasal: Optional[str] = None,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
) -> Dict[str, Any]:
    """Membaca isi pasal spesifik atau rentang baris teks peraturan dari pasal.id."""
    if not is_configured():
        return {
            "found": False,
            "message": "Pencarian dan pembacaan hukum live belum aktif (PASAL_API_TOKENS belum diset).",
        }

    frbr_uri, target_pasal = resolve_frbr_and_pasal(identifier, pasal=pasal)
    if not frbr_uri:
        return {
            "found": False,
            "message": f"Tidak dapat mengenali peraturan dari identifier '{identifier}'.",
        }

    law_data = get_law_detail(frbr_uri)
    if not law_data or not law_data.get("work"):
        return {
            "found": False,
            "message": f"Peraturan dengan identifier/URI '{frbr_uri}' tidak ditemukan di pasal.id.",
        }

    work = law_data.get("work") or {}
    reg_title = _format_regulation(work)
    status = work.get("status", "berlaku")
    articles = law_data.get("articles") or []
    base_url = f"https://pasal.id/peraturan/{work.get('type', '').lower()}/{work.get('type', '').lower()}-no-{work.get('number', '')}-tahun-{work.get('year', '')}"

    # Jika user / model meminta pasal spesifik (contoh: '89' atau 'Pasal 1320')
    if target_pasal:
        m_num = re.search(r"\d+[a-z]?", str(target_pasal).lower())
        p_num = m_num.group(0) if m_num else str(target_pasal).strip().lower()

        matched = [
            a for a in articles
            if str(a.get("type", "")).lower() == "pasal" and str(a.get("number", "")).strip().lower() == p_num
        ]
        if matched:
            a = matched[0]
            num = a.get("number")
            heading = (a.get("heading") or "").strip()
            content = (a.get("content") or "").strip()
            header_lines = [
                f"=== {reg_title} ===",
                f"Status: {status}",
                f"Pasal {num}" + (f" ({heading})" if heading else ""),
                "",
            ]
            body_lines = content.splitlines() if content else ["(Isi teks pasal ini kosong dalam database atau telah diperbarui/diamandemen.)"]
            all_pasal_lines = header_lines + body_lines
            total_p_lines = len(all_pasal_lines)

            # Jika pasal sangat panjang (>100 baris) atau start_line/end_line ditentukan
            if start_line is not None or end_line is not None or total_p_lines > 100:
                s = max(1, min(int(start_line) if start_line is not None else 1, total_p_lines))
                default_e = min(total_p_lines, s + 60)
                e = max(s, min(int(end_line) if end_line is not None else default_e, total_p_lines))
                if e - s > 150:
                    e = s + 150
                sliced_p = all_pasal_lines[s - 1 : e]
                return {
                    "found": True,
                    "regulation": reg_title,
                    "pasal": f"Pasal {num}",
                    "status": status,
                    "frbr_uri": frbr_uri,
                    "url": f"{base_url}/pasal-{num}",
                    "start_line": s,
                    "end_line": e,
                    "total_lines": total_p_lines,
                    "content": "\n".join(sliced_p),
                    "hint": f"Gunakan read_law(identifier='{frbr_uri}', pasal='{num}', start_line={e+1}, end_line={min(total_p_lines, e+60)}) untuk membaca baris lanjutan dari pasal ini." if e < total_p_lines else "Akhir dari isi pasal.",
                }

            return {
                "found": True,
                "regulation": reg_title,
                "pasal": f"Pasal {num}",
                "status": status,
                "frbr_uri": frbr_uri,
                "url": f"{base_url}/pasal-{num}",
                "total_lines": total_p_lines,
                "content": "\n".join(all_pasal_lines),
            }
        return {
            "found": False,
            "regulation": reg_title,
            "message": f"Pasal {target_pasal} tidak ditemukan di dalam {reg_title}.",
        }

    # Jika membaca seluruh atau rentang baris peraturan
    lines = [f"=== {reg_title} ===", f"Status: {status}", ""]
    for a in articles:
        a_type = (a.get("type") or "").lower()
        a_num = str(a.get("number") or "")
        heading = (a.get("heading") or "").strip()
        content = (a.get("content") or "").strip()
        if a_type in ("bab", "bagian", "paragraf"):
            lines.append(f"[{a_type.upper()} {a_num}] {heading}".strip())
        elif a_type == "pasal":
            h = f"Pasal {a_num}" + (f" ({heading})" if heading else "")
            lines.append(h)
            if content:
                lines.append(content)
            lines.append("")

    total_lines = len(lines)
    s = max(1, min(int(start_line) if start_line is not None else 1, total_lines))
    default_end = min(total_lines, s + 60)
    e = max(s, min(int(end_line) if end_line is not None else default_end, total_lines))
    if e - s > 150:
        e = s + 150

    sliced = lines[s - 1 : e]
    return {
        "found": True,
        "regulation": reg_title,
        "status": status,
        "frbr_uri": frbr_uri,
        "url": base_url,
        "start_line": s,
        "end_line": e,
        "total_lines": total_lines,
        "content": "\n".join(sliced),
        "hint": f"Gunakan read_law(identifier='{frbr_uri}', start_line={e+1}, end_line={min(total_lines, e+60)}) untuk melanjutkan membaca baris berikutnya." if e < total_lines else "Akhir dari dokumen peraturan.",
    }
