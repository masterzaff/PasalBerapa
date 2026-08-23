# PasalBerapa? — AI Node / Gateway API Contract

The **frontend is a privacy-first wrapper**. All AI work (PII masking, legal
lookup, LLM analysis) runs on **your own server** (this `ai_node`). Legal search
goes to the live **pasal.id** API via tool calling — the old local ChromaDB index
is gone, along with `POST /search`.

## Env vars the frontend reads

Read at **build time** (`NEXT_PUBLIC_*` is inlined by Next), so changing one
requires a rebuild. There is no runtime override; the Settings panel that used to
provide one has been removed.

| Env var | Meaning |
| --- | --- |
| `NEXT_PUBLIC_AI_NODE_URL` | Base URL used for the `GET /health` connectivity check. |
| `NEXT_PUBLIC_PII_ENDPOINT` | Full URL of the PII masking endpoint (POST). |
| `NEXT_PUBLIC_ANALYZE_ENDPOINT` | Full URL of the analysis endpoint (POST). |
| `NEXT_PUBLIC_TIMEOUT_MS` | Optional request timeout, default `60000`. |

---

## 1) `GET {AI_NODE_URL}/health`

Liveness probe. Returns HTTP `200`.

```json
{
  "status": "ok",
  "service": "pasalberapa-ai-node",
  "version": "1.0.0",
  "pii_engine": "ner:cahya/bert-base-indonesian-NER+regex-id",
  "pii_ner": { "ok": true, "model": "...", "threshold": 0.7, "error": null, "warning": null },
  "llm": { "configured": true, "model": "..." },
  "pasal_id_configured": true,
  "pasal_id_tokens": 1
}
```

**`status` is `"degraded"`, not `"ok"`, when `pii_ner.ok` is false.** The NER
model failed to load and masking has fallen back to regex only: structured PII
(NIK, NPWP, phone, email) is still caught, but **person names are not detected at
all** and will reach the LLM verbatim. Treat it as a privacy failure, not a
quality dip. Set `PII_REQUIRE_NER=1` to make the node refuse to start instead.

---

## 2) `POST {PII_ENDPOINT}` — Masking

Receives raw text and returns masked text + a tag→value mapping.

This is the **only** endpoint that sees unmasked PII, and it must: server-side
NER cannot mask what it cannot read. It must therefore never log request or
response bodies. Nothing downstream — LLM, database, logs — receives real values.

The frontend holds the mapping in memory to unmask LLM output for display. When
the user is signed in it is also **encrypted client-side (AES-GCM, key derived
from the password via split-KDF) and stored** as `pii_mapping_enc`; the server
keeps an opaque blob it cannot read. Everything else persisted stays masked.

**Request**
```json
{
  "text": "Perjanjian ini dibuat oleh Andi Wibowo (NIK 3201...) ...",
  "session_id": "sess_ab12cd34",
  "known_mapping": { "<PERSON_1>": "Andi Wibowo" }
}
```

`known_mapping` (optional) continues an in-flight session: a value that already
has a tag reuses it, and new tags continue the numbering instead of restarting
at `_1`. Required when masking a chat question against an already-masked
document, or the question's tags collide with the document's.

**Response**
```json
{
  "masked_text": "Perjanjian ini dibuat oleh <PERSON_1> (NIK <NIK_1>) ...",
  "mapping": {
    "<PERSON_1>": "Andi Wibowo",
    "<NIK_1>": "3201xxxxxxxxxxxx",
    "<EMAIL_1>": "andiwi12@gmail.com"
  },
  "entities": [
    { "tag": "<NIK_1>", "type": "NIK", "value": "3201xxxxxxxxxxxx" }
  ]
}
```

`mapping` is the **merged** result (anything passed in `known_mapping`, plus
whatever was found now). `entities` lists **only newly discovered** values — not
everything in `mapping` — so a caller can tell what this call added.

**Tag format (required):** `<TYPE_N>` — uppercase type + underscore + index.
Supported types the UI labels nicely: `PERSON, EMAIL, PHONE, NIK, ADDRESS, NPWP,
ACCOUNT, DATE, ORG, MONEY`. Unknown types still render (shown as-is).

---

## 3) `POST {ANALYZE_ENDPOINT}` — Analysis (LLM + tool calling)

Receives the **masked** text and a `mode`, returns a structured, tag-preserving
analysis. The frontend unmasks all text fields before display.

`history[].content` and `question` must already be masked by the caller — the
frontend re-masks history with the session mapping before sending, so real values
never leave the browser after the first turn.

**Request**
```json
{
  "masked_text": "...",
  "mode": "risk",              // "risk" | "summary" | "key_articles" | "chat"
  "question": "aku boleh resign kapan aja nggak?",  // present when mode == "chat"
  "history": [ { "role": "user", "content": "..." } ],
  "session_id": "sess_ab12cd34"
}
```

**Response** (only `reply` is strictly required; the rest enrich the UI)
```json
{
  "reply": "Oke, jadi kontrak <PERSON_1> ini intinya ...",
  "summary": "Ringkasan singkat ...",
  "risk_score": 72,
  "risks": [
    {
      "id": "r1",
      "level": "high",                 // "high" | "warning" | "safe"
      "title": "Penalti resign sepihak",
      "explanation": "Kalau <PERSON_1> resign sebelum 2 tahun, kena denda ...",
      "article_refs": ["Pasal 62 UU Ketenagakerjaan"],
      "suggestion": "Minta klausul ini dinegosiasi ...",
      "source_excerpt": "kutipan paragraf terkait dari dokumen"
    }
  ],
  "citations": [
    {
      "regulation": "UU No. 13 Tahun 2003",
      "article": "Pasal 62",
      "snippet": "...",
      "url": "https://peraturan.go.id/..."
    }
  ],
  "actions": [
    { "tool": "search_indonesian_law", "label": "Cari pasal hukum: \"pemutusan sepihak\"" },
    { "tool": "read_document_lines", "label": "Baca dokumen baris 40-70" }
  ]
}
```
`actions` is a breakdown of the tool calls the agent made during this request (ReAct loop), in order. Always present, may be `[]`. Meant for an optional "what did the assistant do" expander in the UI — not required for basic rendering.

`debug.llm_messages` is the exact `messages` array (system/user/assistant/tool turns) the LLM saw on its last call for this request — meant for a dev-facing "show me the request" debug view, not required for basic rendering. This is a self-hosted node, so it's safe to always include; a public multi-tenant deployment would want to gate this behind an env flag before exposing it.

### LLM persona / prompt rules (must-follow on the server)
- Bertindak sebagai **asisten hukum Indonesia yang kasual tapi akurat**.
- **WAJIB mempertahankan tag PII** (mis. `<PERSON_1>`) di jawaban; jangan pernah
  menebak nama/identitas asli.
- Untuk kontrak, **soroti "Red Flags"** (poin yang merugikan) secara eksplisit.
- Campur gaya: penjelasan santai, tapi rujukan hukum tetap formal ("Pasal 1320
  KUHPerdata").

---

## CORS
Enable CORS for the frontend origin (the preview URL / your deployed domain) on
all three endpoints, including `OPTIONS` preflight.

## Error shape
Return non-2xx with a JSON body; the frontend surfaces `detail` or `message`:
```json
{ "detail": "Vector DB tidak dapat diakses." }
```
