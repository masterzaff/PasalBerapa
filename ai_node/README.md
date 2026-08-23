# PasalBerapa? — AI Node

"Otak" PasalBerapa? yang kamu **host sendiri** (privacy-first). Menyediakan:

- **PII Masking** — NER Indonesia (`cahya/bert-base-indonesian-NER`) untuk nama /
  organisasi / lokasi, **plus** regex Indonesia sebagai jaminan cakupan untuk PII
  terstruktur (NIK, NPWP, No. HP, Email, Rupiah, Alamat, No. Rekening).
- **Pencarian hukum** — API **pasal.id** lewat tool calling (bukan indeks lokal).
- **LLM** — pemanggilan endpoint **OpenAI-compatible** (`/chat/completions`)
  dengan loop ReAct tool calling.

Frontend `PasalBerapa?` hanyalah *wrapper*: ia memanggil endpoint di node ini.
Lihat **`API_CONTRACT.md`** untuk bentuk payload/respons persis.

---

## Struktur

| File | Fungsi |
| --- | --- |
| `app.py` | FastAPI: route `/health`, `/mask`, `/analyze` |
| `masker.py` | PII masking (NER Indonesia + regex) → tag `<TYPE_N>` |
| `test_masker.py` | Regression gate masking (bocor DAN over-masking) |
| `pasal_client.py` | Pencarian hukum via API pasal.id (rotasi token) |
| `prompts.py` | Persona + skema JSON output (jaga tag PII, soroti red flags) |
| `llm.py` | Klien LLM OpenAI-compatible + ReAct tool calling (via `httpx`) |
| `tools.py` | Definisi & eksekusi tool untuk agent |
| `Dockerfile` / `entrypoint.sh` | Build & jalankan |
| `.env.example` | Contoh konfigurasi environment |

---

## Konfigurasi (ENV)

Salin `.env.example` → `.env`, lalu isi. **Kredensial LLM tidak di-hardcode.**

| ENV | Default | Keterangan |
| --- | --- | --- |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Base URL Chat Completions (OpenAI / vLLM / Ollama / dst) |
| `LLM_API_KEY` | — | **Wajib** untuk `/analyze`. Dikirim sebagai `Bearer`. |
| `LLM_MODEL` | `gpt-4o-mini` | Nama model |
| `NER_MODEL` | `cahya/bert-base-indonesian-NER` | Model NER Indonesia (PERSON/ORG/LOKASI). Di-bake ke image saat build (`HF_HOME=/opt/hf`, sengaja di luar volume `/data`). |
| `PII_SCORE_THRESHOLD` | `0.70` | Ambang skor NER. Entitas asli ~0.96–0.99, sampah ~0.25–0.55. |
| `PII_WINDOW_CHARS` | `1500` | Ukuran jendela teks (model dibatasi 512 token; dipotong di batas paragraf/kalimat). |
| `PII_REQUIRE_NER` | `0` | `1` = tolak start kalau NER gagal dimuat. **Nyalakan di produksi**: fallback regex-only sama sekali tidak mendeteksi nama, jadi nama asli akan lolos ke LLM. |
| `PASAL_API_TOKENS` | — | Token pasal.id, pisahkan dengan koma (dirotasi round-robin). |

> Pencarian hukum memakai API **pasal.id** (`pasal_client.py`). ChromaDB +
> sentence-transformers dan skrip ingest sudah dihapus: dataset upstream-nya
> mati dan indeksnya selalu berisi 0 dokumen.

---

## Jalankan dengan Docker (disarankan)

```bash
cd ai_node
cp .env.example .env        # lalu isi LLM_API_KEY dll
docker build -t pasalberapa-ai .
docker run --rm -p 8000:8000 --env-file .env pasalberapa-ai
```

Node-nya stateless: model NER sudah di-bake ke image (`HF_HOME=/opt/hf`), jadi
start-nya langsung tanpa indexing atau unduhan.

Cek kesehatan (`status` jadi `degraded` kalau NER gagal dimuat — artinya deteksi
nama sedang mati):

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

# 2) Masking lanjutan (pertanyaan chat, tag menyambung dari dokumen)
curl -s -X POST http://localhost:8000/mask \
  -H 'Content-Type: application/json' \
  -d '{"text":"Apakah Budi Santoso boleh resign?","known_mapping":{"<PERSON_1>":"Budi Santoso"}}'

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
