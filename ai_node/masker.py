"""
PasalBerapa? — PII Masking (Redaction)
======================================
Menggunakan Microsoft **Presidio** (spaCy multilingual NER) + *custom pattern
recognizers* untuk konteks Indonesia (NIK, NPWP, No. HP, Email, Rupiah, Alamat,
No. Rekening). Hasilnya sesuai `API_CONTRACT.md`:

    masked_text : teks dengan tag <TYPE_N>
    mapping     : {"<PERSON_1>": "Andi Wibowo", ...}
    entities    : [{"tag": "<PERSON_1>", "type": "PERSON", "value": "..."}]

Catatan desain:
- spaCy `xx_ent_wiki_sm` (multilingual) dipetakan ke lang_code "id" lewat
  `ner_model_configuration` (PER->PERSON, LOC->LOCATION, ORG->ORGANIZATION).
- Regex Indonesia SELALU dijalankan sebagai jaminan (meski Presidio meleset),
  lalu overlap di-dedup (pilih span lebih panjang / skor lebih tinggi).
- Jika Presidio/spaCy tidak tersedia, otomatis fallback ke regex-only (server
  tetap hidup, PERSON via NER dimatikan sampai model tersedia).
"""
import os
import re
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger("pasalberapa.masker")

SPACY_MODEL = os.environ.get("SPACY_MODEL", "xx_ent_wiki_sm")
PII_LANG = os.environ.get("PII_LANG", "id")
PII_SCORE_THRESHOLD = float(os.environ.get("PII_SCORE_THRESHOLD", "0.35"))

# Presidio entity type -> tipe tag pada kontrak (UI merender label ini)
TYPE_MAP = {
    "PERSON": "PERSON",
    "EMAIL_ADDRESS": "EMAIL",
    "PHONE_NUMBER": "PHONE",
    "LOCATION": "ADDRESS",
    "ORGANIZATION": "ORG",
    "DATE_TIME": "DATE",
    "IBAN_CODE": "ACCOUNT",
    "CREDIT_CARD": "ACCOUNT",
    # entity kustom Indonesia:
    "ID_NIK": "NIK",
    "ID_NPWP": "NPWP",
    "ID_PHONE": "PHONE",
    "ID_MONEY": "MONEY",
    "ID_ADDRESS": "ADDRESS",
    "ID_ACCOUNT": "ACCOUNT",
    "ID_EMAIL": "EMAIL",
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
    (re.compile(r"\b(?:Jl\.?|Jalan)\s+[^,\n.;]{3,70}", re.IGNORECASE), "ADDRESS", 0.6),
    # No. rekening bank (didahului kata kunci rekening/rek/norek)
    (re.compile(r"(?:(?:no\.?\s*)?(?:rekening|rek|norek)\.?\s*[:#]?\s*)(\d[\d\s-]{6,18}\d)", re.IGNORECASE), "ACCOUNT", 0.7),
]

# ---------------------------------------------------------------------------
# Presidio analyzer (lazy singleton, dengan graceful fallback)
# ---------------------------------------------------------------------------
_analyzer = None
_analyzer_ready = False


def _build_analyzer():
    """Bangun AnalyzerEngine Presidio dgn spaCy multilingual utk lang 'id'.
    Return None jika presidio/spaCy tidak tersedia (fallback regex-only)."""
    try:
        from presidio_analyzer import AnalyzerEngine, RecognizerRegistry, PatternRecognizer, Pattern
        from presidio_analyzer.predefined_recognizers import SpacyRecognizer, EmailRecognizer
        from presidio_analyzer.nlp_engine import NlpEngineProvider
    except Exception as e:  # library belum terpasang
        logger.warning("[masker] presidio tidak tersedia (%s) -> fallback regex-only.", e)
        return None

    try:
        nlp_configuration = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": PII_LANG, "model_name": SPACY_MODEL}],
            "ner_model_configuration": {
                "model_to_presidio_entity_mapping": {
                    "PER": "PERSON",
                    "PERSON": "PERSON",
                    "LOC": "LOCATION",
                    "GPE": "LOCATION",
                    "FAC": "LOCATION",
                    "ORG": "ORGANIZATION",
                    "MISC": "O",
                },
                "low_confidence_score_multiplier": 0.4,
                "low_score_entity_names": [],
            },
        }
        provider = NlpEngineProvider(nlp_configuration=nlp_configuration)
        nlp_engine = provider.create_engine()

        registry = RecognizerRegistry()
        # NER dari spaCy (PERSON / LOCATION / ORGANIZATION)
        registry.add_recognizer(SpacyRecognizer(supported_language=PII_LANG))
        # Email (pattern, language-agnostic) — daftarkan utk 'id'
        registry.add_recognizer(EmailRecognizer(supported_language=PII_LANG))

        # --- Custom pattern recognizers Indonesia ---
        def pat(entity, name, regexes, ctx=None):
            patterns = [Pattern(name=f"{name}_{i}", regex=rx, score=sc) for i, (rx, sc) in enumerate(regexes)]
            return PatternRecognizer(
                supported_entity=entity,
                name=name,
                patterns=patterns,
                context=ctx or [],
                supported_language=PII_LANG,
            )

        registry.add_recognizer(pat("ID_NPWP", "id_npwp",
                                    [(r"\b\d{2}\.\d{3}\.\d{3}\.\d[-.]\d{3}\.\d{3}\b", 0.9)],
                                    ctx=["npwp", "pajak"]))
        registry.add_recognizer(pat("ID_NIK", "id_nik",
                                    [(r"\b\d{16}\b", 0.5)],
                                    ctx=["nik", "ktp", "induk", "kependudukan"]))
        registry.add_recognizer(pat("ID_PHONE", "id_phone",
                                    [(r"\b(?:\+62|62|0)8[1-9][0-9]{6,11}\b", 0.8)],
                                    ctx=["hp", "telp", "telepon", "wa", "whatsapp"]))
        registry.add_recognizer(pat("ID_MONEY", "id_money",
                                    [(r"Rp\.?\s?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?", 0.85)],
                                    ctx=["rp", "rupiah", "harga", "biaya", "denda"]))
        registry.add_recognizer(pat("ID_ADDRESS", "id_address",
                                    [(r"\b(?:Jl\.?|Jalan)\s+[^,\n.;]{3,70}", 0.55)],
                                    ctx=["alamat", "domisili", "tinggal"]))

        analyzer = AnalyzerEngine(
            nlp_engine=nlp_engine,
            registry=registry,
            supported_languages=[PII_LANG],
        )
        logger.info("[masker] Presidio siap (model=%s lang=%s).", SPACY_MODEL, PII_LANG)
        return analyzer
    except Exception as e:
        logger.warning("[masker] gagal inisialisasi Presidio (%s) -> fallback regex-only.", e)
        return None


def _get_analyzer():
    global _analyzer, _analyzer_ready
    if not _analyzer_ready:
        _analyzer = _build_analyzer()
        _analyzer_ready = True
    return _analyzer


# ---------------------------------------------------------------------------
# Pengumpulan span + dedup overlap
# ---------------------------------------------------------------------------
def _collect_spans(text: str) -> List[Tuple[int, int, str]]:
    raw: List[Tuple[int, int, str, float]] = []

    an = _get_analyzer()
    if an is not None:
        try:
            for r in an.analyze(text=text, language=PII_LANG, score_threshold=PII_SCORE_THRESHOLD):
                ctype = TYPE_MAP.get(r.entity_type)
                if not ctype or ctype == "O":
                    continue
                raw.append((r.start, r.end, ctype, float(r.score)))
        except Exception as e:
            logger.warning("[masker] presidio.analyze gagal (%s) -> regex-only utk request ini.", e)

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


def mask_text(text: str) -> Tuple[str, Dict[str, str], List[Dict[str, str]]]:
    """Redaksi PII -> (masked_text, mapping, entities)."""
    text = text or ""
    spans = _collect_spans(text)

    mapping: Dict[str, str] = {}
    entities: List[Dict[str, str]] = []
    counters: Dict[str, int] = {}
    value_to_tag: Dict[Tuple[str, str], str] = {}

    def make_tag(kind: str, value: str) -> str:
        value = value.strip()
        key = (kind, value.lower())
        if key in value_to_tag:
            return value_to_tag[key]
        counters[kind] = counters.get(kind, 0) + 1
        tag = f"<{kind}_{counters[kind]}>"
        mapping[tag] = value
        value_to_tag[key] = tag
        entities.append({"tag": tag, "type": kind, "value": value})
        return tag

    out: List[str] = []
    cursor = 0
    for s, e, kind in spans:
        if s < cursor:
            continue
        out.append(text[cursor:s])
        out.append(make_tag(kind, text[s:e]))
        cursor = e
    out.append(text[cursor:])

    return "".join(out), mapping, entities


def engine_name() -> str:
    return "presidio+regex-id" if _get_analyzer() is not None else "regex-id-only"
