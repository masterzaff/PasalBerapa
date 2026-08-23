"""
PasalBerapa? — PII Masking (Redaction)
======================================
Dua lapis, sengaja dipisah tanggung jawabnya:

1. **Regex Indonesia** — memiliki PII terstruktur (NIK, NPWP, No. HP, Email,
   Rupiah, Alamat, No. Rekening). Deterministik, selalu dijalankan, tidak pernah
   dibuang oleh lapis manapun. Ini jaminan cakupan.
2. **NER (transformers)** — hanya untuk yang tidak bisa diregex: nama orang,
   organisasi, dan lokasi.

Hasil sesuai `API_CONTRACT.md`:

    masked_text : teks dengan tag <TYPE_N>
    mapping     : {"<PERSON_1>": "Andi Wibowo", ...}
    entities    : [{"tag": "<PERSON_1>", "type": "PERSON", "value": "..."}]

Catatan desain
--------------
Lapis NER dulu memakai Presidio + spaCy `xx_ent_wiki_sm` (model Wikipedia
multibahasa yang mungil). Pada teks hukum Indonesia hasilnya buruk di DUA arah:
nama asli lolos (`Siti Nurhaliza binti <PERSON_5>`) sementara kosakata hukum
justru disensor (`Nilai` -> PERSON, `Denda` -> ADDRESS, `Pihak Pertama` ->
PERSON), sehingga LLM tidak bisa membaca dokumennya. Skornya pun rata 0.85 untuk
SEMUA span, jadi threshold tidak berarti apa-apa dan tidak bisa di-tuning.

Sekarang memakai model NER berbahasa Indonesia (`cahya/bert-base-indonesian-NER`
secara default). Skornya informatif (entitas asli 0.96-0.99, sampah 0.25-0.55)
sehingga `PII_SCORE_THRESHOLD` benar-benar bekerja.

Presidio sendiri sudah dilepas: satu-satunya kontribusinya yang tersisa adalah
meng-host spaCy recognizer di atas, karena kelima *pattern recognizer*-nya
persis menduplikasi `_REGEX_RECOGNIZERS` di bawah.

Jika transformers/model gagal dimuat, server tetap hidup dengan regex-only
(deteksi nama dimatikan sampai model tersedia).
"""
import os
import re
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("pasalberapa.masker")

NER_MODEL = os.environ.get("NER_MODEL", "cahya/bert-base-indonesian-NER")
PII_SCORE_THRESHOLD = float(os.environ.get("PII_SCORE_THRESHOLD", "0.70"))

# Model dibatasi 512 token; kontrak jauh lebih panjang. Teks dipotong per
# jendela pada batas paragraf/kalimat supaya tidak ada entitas yang terbelah.
_WINDOW = int(os.environ.get("PII_WINDOW_CHARS", "1500"))

# Label model -> tipe tag pada kontrak (UI merender label ini).
# Tipe lain (MON/CRD/ORD/PRD/LAW/DAT) sengaja diabaikan: PII terstruktur adalah
# milik lapis regex, dan ORD/PRD justru sumber false positive ("Pihak Pertama").
_NER_TYPE_MAP = {
    "PER": "PERSON",
    "PERSON": "PERSON",
    "ORG": "ORG",
    "LOC": "ADDRESS",
    "GPE": "ADDRESS",
}

# Jaring pengaman: kosakata hukum/dokumen yang tidak boleh disensor meski NER
# salah menandainya. Hanya berlaku untuk span NER — span regex tidak pernah
# dibuang lewat sini.
_DENY = {
    "pihak", "pihak pertama", "pihak kedua", "pihak ketiga", "para pihak",
    "pertama", "kedua", "ketiga",
    "pasal", "ayat", "huruf", "bab", "lampiran",
    "perjanjian", "kontrak", "kesepakatan", "surat", "akta", "dokumen",
    "nilai", "denda", "biaya", "harga", "jumlah", "total", "sanksi", "ganti rugi",
    "nik", "npwp", "ktp", "rekening", "bank",
    "direktur", "komisaris", "saksi", "notaris", "jabatan",
    "undang-undang", "peraturan", "keputusan", "kuhperdata", "kuhp",
}


# ---------------------------------------------------------------------------
# Regex Indonesia (jaminan cakupan). (pattern, contract_type, score)
# ---------------------------------------------------------------------------
_REGEX_RECOGNIZERS = [
    (re.compile(r"\b\d{2}\.\d{3}\.\d{3}\.\d[-.]\d{3}\.\d{3}\b"), "NPWP", 0.9),
    (re.compile(r"\b\d{16}\b"), "NIK", 0.6),
    (re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"), "EMAIL", 0.9),
    (re.compile(r"\b(?:\+62|62|0)8[1-9][0-9]{6,11}\b"), "PHONE", 0.85),
    (re.compile(r"Rp\.?\s?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?", re.IGNORECASE), "MONEY", 0.85),
    # Sengaja konservatif (berhenti di titik): NER yang menangkap alamat utuh
    # "Jl. Merdeka No. 45", dan span terpanjang menang saat dedup. Kalau regex
    # ini dilonggarkan, di mode regex-only ia bisa melahap kalimat berikutnya.
    (re.compile(r"\b(?:Jl\.?|Jalan)\s+[^,\n.;]{3,70}", re.IGNORECASE), "ADDRESS", 0.6),
    # No. rekening bank (didahului kata kunci rekening/rek/norek)
    (re.compile(r"(?:(?:no\.?\s*)?(?:rekening|rek|norek)\.?\s*[:#]?\s*)(\d[\d\s-]{6,18}\d)", re.IGNORECASE), "ACCOUNT", 0.7),
]


# ---------------------------------------------------------------------------
# NER (lazy singleton, dengan graceful fallback ke regex-only)
# ---------------------------------------------------------------------------
_ner = None
_ner_ready = False


def _build_ner():
    try:
        from transformers import pipeline
    except Exception as e:
        logger.warning("[masker] transformers tidak tersedia (%s) -> regex-only.", e)
        return None
    try:
        nlp = pipeline("ner", model=NER_MODEL, aggregation_strategy="simple")
        logger.info("[masker] NER siap (model=%s, threshold=%.2f).", NER_MODEL, PII_SCORE_THRESHOLD)
        return nlp
    except Exception as e:
        logger.warning("[masker] gagal memuat NER '%s' (%s) -> regex-only.", NER_MODEL, e)
        return None


def _get_ner():
    global _ner, _ner_ready
    if not _ner_ready:
        _ner = _build_ner()
        _ner_ready = True
    return _ner


def _windows(text: str, size: int = None) -> List[Tuple[int, str]]:
    """Potong teks jadi (offset, chunk) pada batas paragraf/kalimat/spasi.
    Tidak pernah memotong di tengah kata, jadi entitas tidak terbelah."""
    size = size or _WINDOW
    n = len(text)
    if n <= size:
        return [(0, text)]

    out: List[Tuple[int, str]] = []
    pos = 0
    while pos < n:
        if n - pos <= size:
            out.append((pos, text[pos:]))
            break
        end = pos + size
        for sep in ("\n\n", "\n", ". ", " "):
            cut = text.rfind(sep, pos + size // 2, end)
            if cut > pos:
                end = cut + len(sep)
                break
        out.append((pos, text[pos:end]))
        pos = end
    return out


# Token yang tidak boleh ikut tertelan saat memanjangkan span nama: singkatan
# badan usaha / gelar berhuruf besar semua yang sering menempel pada nama.
_ABBR = {"PT", "CV", "UD", "PD", "NIK", "NPWP", "KTP", "SK", "UU", "RT", "RW"}
# Tanpa "^": .match(text, pos) sudah menjangkar di pos, sedangkan "^" justru
# menuntut awal baris sehingga tidak pernah cocok di tengah kalimat.
_NEXT_WORD = re.compile(r" ([A-Z][A-Za-z'’.\-]+)")


def _extend_person(text: str, s: int, e: int) -> int:
    """Serap kata berkapital yang menempel di kanan span nama.

    Model NER-nya tidak stabil di batas nama lengkap: pada kalimat terpisah ia
    mengembalikan 'Andi Wijaya' utuh, tapi dengan konteks satu dokumen penuh ia
    hanya mengembalikan 'Andi' — menyisakan 'Wijaya' terbaca jelas. Nama yang
    tersensor separuh tetap bocor, jadi jangan percaya batas dari model.

    Hanya menyeberang SATU spasi (bukan tanda baca), supaya tidak melompati
    batas kalimat, dan berhenti pada kata di `_DENY`/`_ABBR`. Risiko terburuk
    adalah kelebihan satu kata — jauh lebih murah daripada nama marga bocor.
    """
    for _ in range(3):
        m = _NEXT_WORD.match(text, e)
        if not m:
            break
        word = m.group(1)
        if word.lower() in _DENY or word.rstrip(".") in _ABBR or word.isupper():
            break
        e = m.end()
    # Titik di dalam token dipertahankan (gelar: "Ir.", "H."), tapi tanda baca
    # di UJUNG milik kalimat, bukan nama — kalau ikut tertelan, nilai mapping
    # jadi "Dewi Lestari." dan tidak akan cocok lagi saat remask.
    while e > s and not text[e - 1].isalnum():
        e -= 1
    return e


def _ner_spans(text: str) -> List[Tuple[int, int, str, float]]:
    nlp = _get_ner()
    if nlp is None:
        return []

    spans: List[Tuple[int, int, str, float]] = []
    for offset, chunk in _windows(text):
        try:
            ents = nlp(chunk)
        except Exception as e:
            logger.warning("[masker] NER gagal pada satu jendela (%s) -> dilewati.", e)
            continue

        for ent in ents:
            ctype = _NER_TYPE_MAP.get(str(ent.get("entity_group") or ""))
            if not ctype:
                continue
            score = float(ent.get("score") or 0.0)
            if score < PII_SCORE_THRESHOLD:
                continue

            s = offset + int(ent["start"])
            e = offset + int(ent["end"])
            # Ambil surface dari teks ASLI: field `word` dari pipeline sudah
            # lowercase dan membawa artefak wordpiece ("##").
            raw = text[s:e]
            s += len(raw) - len(raw.lstrip())
            e -= len(raw) - len(raw.rstrip())
            surface = text[s:e]

            if len(surface) < 3 or surface.lower() in _DENY:
                continue
            if not any(ch.isalpha() for ch in surface):
                continue
            if ctype == "PERSON":
                e = _extend_person(text, s, e)
            spans.append((s, e, ctype, score))
    return spans


# ---------------------------------------------------------------------------
# Pengumpulan span + dedup overlap
# ---------------------------------------------------------------------------
def _collect_spans(text: str) -> List[Tuple[int, int, str]]:
    raw: List[Tuple[int, int, str, float]] = list(_ner_spans(text))

    # Regex Indonesia SELALU dijalankan sebagai jaminan.
    for pattern, ctype, score in _REGEX_RECOGNIZERS:
        for m in pattern.finditer(text):
            # untuk pola ber-group (rekening), pakai group(1) bila ada
            if m.groups():
                s, e = m.start(1), m.end(1)
            else:
                s, e = m.start(), m.end()
            raw.append((s, e, ctype, score))

    # Urutkan: posisi awal, lalu span lebih panjang, lalu skor lebih tinggi.
    raw.sort(key=lambda x: (x[0], -(x[1] - x[0]), -x[3]))

    chosen: List[Tuple[int, int, str]] = []
    last_end = -1
    for s, e, ctype, _score in raw:
        if s >= last_end and e > s:
            chosen.append((s, e, ctype))
            last_end = e
    return chosen


def mask_text(
    text: str,
    known_mapping: Optional[Dict[str, str]] = None,
) -> Tuple[str, Dict[str, str], List[Dict[str, str]]]:
    """Redaksi PII -> (masked_text, mapping, new_entities).

    `known_mapping` menyambung sesi yang sudah berjalan: nilai yang sudah punya
    tag memakai tag yang sama, dan penomoran tag baru melanjutkan yang ada
    (bukan mengulang dari _1). Tanpa ini, menyensor pertanyaan chat akan
    bertabrakan dengan tag milik dokumen.

    `mapping` yang dikembalikan sudah tergabung (lama + baru); `new_entities`
    hanya berisi yang baru ditemukan pada panggilan ini.
    """
    text = text or ""

    mapping: Dict[str, str] = dict(known_mapping or {})
    new_entities: List[Dict[str, str]] = []
    counters: Dict[str, int] = {}
    value_to_tag: Dict[Tuple[str, str], str] = {}

    # Seed dari mapping yang sudah ada supaya tag konsisten & nomor menyambung.
    for tag, value in mapping.items():
        m = re.match(r"^<([A-Z_]+)_(\d+)>$", tag)
        if not m:
            continue
        kind, idx = m.group(1), int(m.group(2))
        value_to_tag[(kind, str(value).strip().lower())] = tag
        counters[kind] = max(counters.get(kind, 0), idx)

    def make_tag(kind: str, value: str) -> str:
        value = value.strip()
        key = (kind, value.lower())
        if key in value_to_tag:
            return value_to_tag[key]
        counters[kind] = counters.get(kind, 0) + 1
        tag = f"<{kind}_{counters[kind]}>"
        mapping[tag] = value
        value_to_tag[key] = tag
        new_entities.append({"tag": tag, "type": kind, "value": value})
        return tag

    spans = _collect_spans(text)
    out: List[str] = []
    cursor = 0
    for s, e, kind in spans:
        if s < cursor:
            continue
        out.append(text[cursor:s])
        out.append(make_tag(kind, text[s:e]))
        cursor = e
    out.append(text[cursor:])

    return "".join(out), mapping, new_entities


def engine_name() -> str:
    return f"ner:{NER_MODEL}+regex-id" if _get_ner() is not None else "regex-id-only"
