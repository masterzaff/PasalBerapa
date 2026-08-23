#!/usr/bin/env bash
set -e

# Muat variabel dari .env bila ada (tanpa menimpa env yang sudah diset).
if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

exec uvicorn app:app --host 0.0.0.0 --port 8000
