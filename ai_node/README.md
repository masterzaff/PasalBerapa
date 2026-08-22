# ai_node/

Rumah untuk **AI node** yang kamu host sendiri: PII masking (model/regex), Vector DB
(RAG dokumen `peraturan.go.id`), dan pemanggilan LLM (OpenAI via Emergent key /
Groq). Frontend `PasalBerapa?` hanya wrapper yang memanggil endpoint di sini.

- Lihat **`API_CONTRACT.md`** untuk bentuk endpoint (`/health`, masking, analyze)
  yang diharapkan frontend.
- Isi implementasinya belakangan sesuai stack pilihanmu (FastAPI direkomendasikan).

> Catatan: folder ini sengaja dibiarkan sebagai placeholder + kontrak API sesuai
> permintaan ("backend & AI node dihost di server sendiri, dijelaskan nanti").
