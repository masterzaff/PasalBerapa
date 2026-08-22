#!/usr/bin/env bash
set -e

# Muat variabel dari .env bila ada (tanpa menimpa env yang sudah diset).
if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ "${AUTO_INGEST:-1}" = "1" ]; then
  if python -c "import os,chromadb,sys; c=chromadb.PersistentClient(path=os.environ.get('CHROMA_PATH','/data/chroma')); col=c.get_or_create_collection(os.environ.get('COLLECTION','peraturan')); sys.exit(0 if col.count()==0 else 1)"; then
    echo "[entrypoint] Index kosong — menjalankan ingest..."
    python ingest.py || echo "[entrypoint] ingest gagal, lanjut serve kosong."
  else
    echo "[entrypoint] Index sudah ada, skip ingest."
  fi
fi
exec uvicorn app:app --host 0.0.0.0 --port 8000
