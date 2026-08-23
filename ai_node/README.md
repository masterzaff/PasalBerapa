# PasalBerapa? — AI Node

"Otak" PasalBerapa? yang kamu **host sendiri** (privacy-first). Menyediakan:

- **PII Masking** — Microsoft **Presidio** + spaCy multilingual (`xx_ent_wiki_sm`)
  + *custom recognizer* Indonesia (NIK, NPWP, No. HP, Email, Rupiah, Alamat, No. Rekening).
- **RAG** — Vector DB **ChromaDB** + embedding Indonesia **`LazarusNLP/all-indo-e5-small-v4`**
  atas dokumen `peraturan.go.id`.
- **LLM** — pemanggilan endpoint **OpenAI-compatible** (`/chat/completions`).

Frontend `PasalBerapa?` hanyalah *wrapper*: ia memanggil endpoint di node ini.
Lihat **`API_CONTRACT.md`** untuk bentuk payload/respons persis.

---

## Struktur

| File | Fungsi |
| --- | --- |
| `app.py` | FastAPI: route `/health`, `/mask`, `/analyze`, `/search` |
| `masker.py` | PII masking (Presidio + regex Indonesia) → tag `<TYPE_N>` |
| `retriever.py` | RAG: ChromaDB + embedding e5 Indonesia |
| `prompts.py` | Persona + skema JSON output (jaga tag PII, soroti red flags) |
| `llm.py` | Klien LLM OpenAI-compatible (via `httpx`) |
| `ingest.py` | Index subset `peraturan.go.id` → ChromaDB |
| `Dockerfile` / `entrypoint.sh` | Build & jalankan (auto-ingest saat index kosong) |
| `.env.example` | Contoh konfigurasi environment |

---

## Konfigurasi (ENV)

Salin `.env.example` → `.env`, lalu isi. **Kredensial LLM tidak di-hardcode.**

| ENV | Default | Keterangan |
| --- | --- | --- |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Base URL Chat Completions (OpenAI / vLLM / Ollama / dst) |
| `LLM_API_KEY` | — | **Wajib** untuk `/analyze`. Dikirim sebagai `Bearer`. |
| `LLM_MODEL` | `gpt-4o-mini` | Nama model |
| `EMBED_MODEL` | `LazarusNLP/all-indo-e5-small-v4` | Model embedding (384-dim, prefix `query:`/`passage:`) |
| `CHROMA_PATH` | `/data/chroma` | Lokasi persist ChromaDB |
| `COLLECTION` | `peraturan` | Nama koleksi |
| `NER_MODEL` | `cahya/bert-base-indonesian-NER` | Model NER Indonesia (PERSON/ORG/LOKASI). Di-bake ke image saat build. |
| `PII_SCORE_THRESHOLD` | `0.70` | Ambang skor NER. Entitas asli ~0.96–0.99, sampah ~0.25–0.55. |
| `PII_WINDOW_CHARS` | `1500` | Ukuran jendela teks (model dibatasi 512 token; dipotong di batas paragraf/kalimat). |
| `INGEST_LIMIT` | `500` | Jumlah dokumen di-index (0 = semua) |
| `CHUNK_CHARS` | `480` | Ukuran chunk (disetel utk max_seq ~128 token e5-small) |
| `AUTO_INGEST` | `1` | Auto-index saat start jika koleksi kosong |

---

## Jalankan dengan Docker (disarankan)

```bash
cd ai_node
cp .env.example .env        # lalu isi LLM_API_KEY dll
docker build -t pasalberapa-ai .
docker run --rm -p 8000:8000 --env-file .env -v pasalberapa_data:/data pasalberapa-ai
```

Saat pertama kali start (koleksi kosong), `entrypoint.sh` menjalankan `ingest.py`
otomatis (sparse-checkout repo + embedding). Ini butuh waktu; log muncul di stdout.

Cek kesehatan:

```bash
curl http://localhost:8000/health
```

---

## Uji cepat (curl)

```bash
# 1) Masking
curl -s -X POST http://localhost:8000/mask \
  -H 'Content-Type: application/json' \
  -d '{"text":"Andi Wibowo, NIK 3201234567890123, HP 081234567890, denda Rp 5.000.000"}'

# 2) Retrieval mentah
curl -s -X POST http://localhost:8000/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"pesangon PHK","top_k":5}'

# 3) Analisis (butuh LLM_BASE_URL + LLM_API_KEY)
curl -s -X POST http://localhost:8000/analyze \
  -H 'Content-Type: application/json' \
  -d '{"masked_text":"Kalau <PERSON_1> resign sebelum 2 tahun kena denda <MONEY_1>.","mode":"risk"}'
```

---

## Menyambungkan ke Frontend

Frontend membaca 3 endpoint (via **Settings** di UI, atau env `frontend/.env`):

| Env frontend | Isi |
| --- | --- |
| `REACT_APP_AI_NODE_URL` | `https://ai-node.domainmu.com` (untuk `GET /health`) |
| `REACT_APP_PII_ENDPOINT` | `https://ai-node.domainmu.com/mask` |
| `REACT_APP_ANALYZE_ENDPOINT` | `https://ai-node.domainmu.com/analyze` |

Setelah node kamu online, cukup isi ketiga nilai itu di panel **Settings** (disimpan
lokal di browser) atau di `frontend/.env`. Tidak perlu ubah kode frontend.

> Pastikan CORS mengizinkan origin frontend (default `CORS_ORIGINS=*`).
