# PasalBerapa? — AI Node / Gateway API Contract

The **frontend is a privacy-first wrapper**. All AI work (PII masking, RAG over
`peraturan.go.id` documents, and LLM analysis) runs on **your own server** (this
`ai_node`). The frontend calls the endpoints below. Configure the URLs in the app's
**Settings** panel (or via env vars in `frontend/.env`).

## Env vars the frontend reads

| Env var | Meaning |
| --- | --- |
| `REACT_APP_AI_NODE_URL` | Base URL used for the `GET /health` connectivity check. |
| `REACT_APP_PII_ENDPOINT` | Full URL of the PII masking endpoint (POST). |
| `REACT_APP_ANALYZE_ENDPOINT` | Full URL of the analysis endpoint (POST). |

All three can also be set at runtime from the **Settings** modal (stored in
`localStorage` as *connection config only* — never document content).

---

## 1) `GET {AI_NODE_URL}/health`

Simple liveness probe. Return HTTP `200` with any JSON body.

```json
{ "status": "ok", "service": "pasalberapa-ai-node", "version": "1.0.0" }
```

---

## 2) `POST {PII_ENDPOINT}` — Masking

Receives raw extracted text and returns masked text + a tag→value mapping.
The frontend keeps the mapping **in memory only** and uses it to unmask LLM output
before display.

**Request**
```json
{
  "text": "Perjanjian ini dibuat oleh Andi Wibowo (NIK 3201...) ...",
  "session_id": "sess_ab12cd34"
}
```

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
    { "tag": "<PERSON_1>", "type": "PERSON", "value": "Andi Wibowo" },
    { "tag": "<NIK_1>", "type": "NIK", "value": "3201xxxxxxxxxxxx" }
  ]
}
```

**Tag format (required):** `<TYPE_N>` — uppercase type + underscore + index.
Supported types the UI labels nicely: `PERSON, EMAIL, PHONE, NIK, ADDRESS, NPWP,
ACCOUNT, DATE, ORG, MONEY`. Unknown types still render (shown as-is).

---

## 3) `POST {ANALYZE_ENDPOINT}` — Analysis (RAG + LLM)

Receives the **masked** text and a `mode`, returns a structured, tag-preserving
analysis. The frontend unmasks all text fields before display.

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
