"""
PasalBerapa? — Agentic Tools for Legal Analysis
===============================================
Koleksi tools yang dapat dipanggil oleh LLM selama proses penalaran (ReAct Loop):
1. search_indonesian_law: Mencari rujukan pasal via pasal.id (KUHPerdata, UU Cipta Kerja, dll.)
2. search_user_document: Mencari potongan klausul di draf kontrak pengguna.
3. read_document_lines: Membaca rentang baris tertentu dari dokumen pengguna secara presisi.
"""
import re
import logging
from typing import List, Dict, Any, Optional

import pasal_client

logger = logging.getLogger("pasalberapa.tools")

LEGAL_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_indonesian_law",
            "description": "Cari rujukan pasal hukum Indonesia resmi (KUHPerdata, UU Ketenagakerjaan/Cipta Kerja, UU PDP, dll.) berdasarkan topik atau kata kunci.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Topik atau isu hukum yang ingin dicari rujukan pasalnya (misal: 'syarat sah perjanjian', 'pemutusan sepihak', 'denda keterlambatan')"
                    },
                    "regulation": {
                        "type": "string",
                        "description": "Nama peraturan spesifik jika ingin difilter (misal: 'KUHPerdata' atau 'UU PDP')"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_law",
            "description": "Membaca teks lengkap peraturan atau isi pasal spesifik dari hukum Indonesia via pasal.id. Gunakan frbr_uri atau url yang didapat dari hasil search_indonesian_law, atau masukkan nama peraturan beserta nomor pasalnya.",
            "parameters": {
                "type": "object",
                "properties": {
                    "identifier": {
                        "type": "string",
                        "description": "FRBR URI (contoh: 'akn/id/act/uu/2003/13'), URL peraturan dari hasil search_indonesian_law, atau nama peraturan"
                    },
                    "pasal": {
                        "type": "string",
                        "description": "Nomor pasal spesifik yang ingin dibaca (contoh: '1', '62', '1320'). Opsional; jika diisi langsung mengambil isi pasal tersebut."
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "Nomor baris awal (1-indexed) jika ingin membaca sebagian baris dari teks peraturan"
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "Nomor baris akhir (1-indexed) jika ingin membaca sebagian baris dari teks peraturan"
                    }
                },
                "required": ["identifier"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_user_document",
            "description": "Mencari kata kunci atau topik klausul di dalam dokumen kontrak pengguna. Mengembalikan cuplikan teks beserta nomor baris tempat klausul tersebut berada.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Kata kunci atau topik klausul yang dicari di dokumen kontrak pengguna (misal: 'penalti', 'ganti rugi', 'kerahasiaan', 'force majeure')"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_document_lines",
            "description": "Membaca baris teks tertentu dari dokumen kontrak pengguna secara utuh (misal baris 40 sampai 70) tanpa membebani context window.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_line": {
                        "type": "integer",
                        "description": "Nomor baris awal yang ingin dibaca (1-indexed)"
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "Nomor baris akhir yang ingin dibaca (1-indexed)"
                    }
                },
                "required": ["start_line", "end_line"]
            }
        }
    }
]


def execute_search_law(query: str, regulation: Optional[str] = None, top_k: int = 4) -> Dict[str, Any]:
    """Cari rujukan pasal via pasal.id (live search API)."""
    results = pasal_client.search(query, regulation=regulation, top_k=top_k)
    if not results:
        if not pasal_client.is_configured():
            msg = "Pencarian pasal live belum aktif (PASAL_API_TOKENS belum diset di server). Gunakan penalaran hukum umum."
        else:
            msg = f"Tidak ditemukan pasal spesifik untuk query '{query}'. Gunakan penalaran hukum umum atau coba kata kunci lain."
        return {"found": False, "message": msg}
    return {
        "found": True,
        "results": results
    }


def execute_read_law(
    identifier: str,
    pasal: Optional[str] = None,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
) -> Dict[str, Any]:
    """Membaca isi pasal spesifik atau potongan teks peraturan dari pasal.id."""
    return pasal_client.read_law_content(
        identifier=identifier,
        pasal=pasal,
        start_line=start_line,
        end_line=end_line,
    )


def execute_search_user_doc(query: str, doc_lines: List[str], max_matches: int = 3) -> Dict[str, Any]:
    """Cari kata kunci di dalam baris dokumen pengguna dan kembalikan lokasinya."""
    if not doc_lines:
        return {"found": False, "message": "Dokumen pengguna kosong."}

    query_terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
    if not query_terms:
        query_terms = [query.lower().strip()]

    matches = []
    total_lines = len(doc_lines)

    for idx, line in enumerate(doc_lines):
        line_lower = line.lower()
        score = sum(1 for term in query_terms if term in line_lower)
        if score > 0:
            # Ambil konteks 2 baris sebelum & sesudah
            start = max(1, idx - 1)
            end = min(total_lines, idx + 3)
            excerpt = "\n".join(doc_lines[start - 1 : end])
            matches.append({
                "line": idx + 1,
                "range": f"Baris {start} - {end}",
                "start_line": start,
                "end_line": end,
                "excerpt": excerpt,
                "score": score
            })

    if not matches:
        return {
            "found": False,
            "message": f"Klausul dengan kata kunci '{query}' tidak ditemukan di dokumen pengguna."
        }

    # Urutkan berdasarkan skor relevansi
    matches.sort(key=lambda x: x["score"], reverse=True)
    top_matches = matches[:max_matches]
    return {
        "found": True,
        "count": len(matches),
        "matches": top_matches,
        "hint": "Gunakan tool read_document_lines(start_line, end_line) jika kamu ingin membaca klausul lebih lengkap di sekitar baris tersebut."
    }


def execute_read_lines(start_line: int, end_line: int, doc_lines: List[str]) -> Dict[str, Any]:
    """Membaca baris start_line sampai end_line dari dokumen pengguna."""
    if not doc_lines:
        return {"error": "Dokumen pengguna kosong."}

    total_lines = len(doc_lines)
    s = max(1, min(start_line, total_lines))
    e = max(s, min(end_line, total_lines))

    # Batasi pembacaan maksimal 120 baris per panggilan agar tidak over context
    if e - s > 120:
        e = s + 120

    sliced = doc_lines[s - 1 : e]
    content = "\n".join(sliced)

    return {
        "start_line": s,
        "end_line": e,
        "total_doc_lines": total_lines,
        "content": content
    }
