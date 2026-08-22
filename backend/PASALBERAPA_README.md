# backend/

Opsional **API gateway** yang kamu host sendiri (jembatan antara frontend dan
`ai_node`: Vector DB + LLM). Jika kamu memilih arsitektur di mana frontend memanggil
gateway ini alih-alih memanggil `ai_node` langsung, gateway harus mengekspos
endpoint yang sama seperti di `../ai_node/API_CONTRACT.md`:

- `GET /health`
- `POST /upload-and-mask` (atau endpoint masking pilihanmu)
- `POST /analyze`

Frontend tidak terikat path tertentu — semua URL dikonfigurasi dari **Settings**
/ env vars, jadi kamu bebas menaruh gateway di mana pun.

> Placeholder sesuai permintaan: backend akan dijelaskan & diisi belakangan.
> Template FastAPI bawaan tetap ada di `server.py` (Hello World) dan tidak dipakai
> oleh frontend wrapper saat ini.
