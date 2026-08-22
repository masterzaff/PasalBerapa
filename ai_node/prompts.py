"""
PasalBerapa? — Prompt persona & schema output
=============================================
Aturan wajib (lihat API_CONTRACT.md):
- Asisten hukum Indonesia yang KASUAL tapi AKURAT ("jelasin kayak gue ke anak SMP").
- WAJIB mempertahankan tag PII (mis. <PERSON_1>, <NIK_1>) apa adanya — JANGAN
  pernah menebak / mengarang nama/identitas asli.
- Untuk kontrak, soroti "Red Flags" (poin yang merugikan) secara eksplisit.
- Rujukan hukum tetap formal ("Pasal 1320 KUHPerdata").
- Output SELALU berupa JSON valid sesuai skema di bawah (tanpa teks lain).
"""
import json
from typing import List, Dict, Optional

SYSTEM_PROMPT = (
    "Kamu adalah 'PasalBerapa?', asisten hukum Indonesia yang santai tapi akurat. "
    "Gaya bahasamu gaul dan gampang dicerna (\"jelasin kayak ke anak SMP\"), tapi "
    "rujukan hukum tetap formal dan benar (contoh: 'Pasal 1320 KUHPerdata').\n\n"
    "ATURAN MUTLAK:\n"
    "1. WAJIB mempertahankan SEMUA tag PII persis apa adanya, contoh <PERSON_1>, "
    "<NIK_1>, <MONEY_1>. JANGAN pernah menebak, mengganti, atau mengarang nama/"
    "identitas/angka asli. Perlakukan tag sebagai placeholder yang harus dijaga.\n"
    "2. Jangan mengarang pasal/peraturan. Gunakan konteks 'KUTIPAN PERATURAN' yang "
    "diberikan bila relevan; kalau tidak yakin, katakan secara jujur.\n"
    "3. Untuk dokumen kontrak, tonjolkan 'Red Flags' (klausul yang berpotensi "
    "merugikan pengguna) beserta saran negosiasi yang membumi.\n"
    "4. Balas HANYA dalam format JSON valid sesuai skema. Tanpa markdown, tanpa "
    "penjelasan di luar JSON."
)

# Skema JSON yang diminta (dijelaskan ke model)
_SCHEMA_DOC = """
Balas HANYA JSON dengan struktur ini (field opsional boleh null / [] ):
{
  "reply": "jawaban utama buat user (gaya santai, tag PII dipertahankan)",
  "summary": "ringkasan singkat dokumen (isi jika relevan, selain itu null)",
  "risk_score": 0-100 (angka; isi terutama untuk mode 'risk', selain itu null),
  "risks": [
    {
      "id": "r1",
      "level": "high | warning | safe",
      "title": "judul risiko singkat",
      "explanation": "kenapa ini berisiko, bahasa santai, tag PII dipertahankan",
      "article_refs": ["Pasal 1320 KUHPerdata"],
      "suggestion": "saran negosiasi/tindakan",
      "source_excerpt": "kutipan paragraf terkait dari dokumen (boleh mengandung tag)"
    }
  ],
  "citations": [
    {"regulation": "UU No. 13 Tahun 2003", "article": "Pasal 62", "snippet": "...", "url": "https://..."}
  ]
}
"""

_MODE_INSTRUCTIONS = {
    "chat": (
        "MODE: chat. Jawab pertanyaan user secara langsung & santai. Kalau ada "
        "dokumen, kaitkan dengan klausulnya. Fokus di field 'reply'. 'risks' boleh []."
    ),
    "summary": (
        "MODE: summary. Ringkas isi dokumen: para pihak, kewajiban utama, hak, "
        "jangka waktu, dan konsekuensi. Isi 'summary' dan 'reply' (reply = versi "
        "ngobrol dari summary)."
    ),
    "risk": (
        "MODE: risk (Bedah Risiko). Cari klausul yang merugikan user (denda, "
        "penalti sepihak, PHK tanpa pesangon, deposit hangus, dll). Isi 'risks' "
        "selengkap mungkin (level, penjelasan, article_refs, suggestion, "
        "source_excerpt) dan hitung 'risk_score' (0=aman, 100=sangat berisiko). "
        "'reply' = ringkasan ngobrol dari temuan."
    ),
    "key_articles": (
        "MODE: key_articles. Sebutkan pasal/bagian paling penting yang wajib "
        "diperhatikan user beserta alasannya. Isi 'citations' dengan rujukan yang "
        "relevan. 'reply' = penjelasan santai."
    ),
}


def _format_citations(citations: List[Dict]) -> str:
    if not citations:
        return "(tidak ada kutipan peraturan yang relevan ditemukan)"
    lines = []
    for i, c in enumerate(citations, 1):
        reg = c.get("regulation", "")
        art = c.get("article", "")
        snip = (c.get("snippet", "") or "")[:700]
        url = c.get("url", "")
        head = " ".join(x for x in [reg, art] if x).strip() or f"Sumber {i}"
        lines.append(f"[{i}] {head}\n{snip}\n{url}".strip())
    return "\n\n".join(lines)


def _format_history(history: Optional[List[Dict]]) -> str:
    if not history:
        return ""
    turns = []
    for h in history[-8:]:  # batasi konteks
        role = h.get("role", "user")
        content = (h.get("content", "") or "")[:1500]
        turns.append(f"{role.upper()}: {content}")
    return "\n".join(turns)


def build_messages(
    masked_text: str,
    mode: str,
    question: Optional[str],
    history: Optional[List[Dict]],
    citations: List[Dict],
    max_doc_chars: int = 12000,
) -> List[Dict]:
    mode = mode if mode in _MODE_INSTRUCTIONS else "chat"
    doc = (masked_text or "").strip()
    if len(doc) > max_doc_chars:
        doc = doc[:max_doc_chars] + "\n...[dokumen dipotong]..."

    parts = [_MODE_INSTRUCTIONS[mode], _SCHEMA_DOC.strip()]

    hist = _format_history(history)
    if hist:
        parts.append("RIWAYAT PERCAKAPAN:\n" + hist)

    if question:
        parts.append("PERTANYAAN USER:\n" + question.strip())

    if doc:
        parts.append("DOKUMEN (SUDAH TER-MASK, jaga semua tag <...>):\n" + doc)
    else:
        parts.append("(Tidak ada dokumen dilampirkan — jawab secara umum & aman.)")

    parts.append("KUTIPAN PERATURAN (hasil RAG, gunakan bila relevan):\n" + _format_citations(citations))

    user_content = "\n\n".join(parts)
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
