FROM python:3.11-slim

# Copy the official uv binary for ultra-fast, multi-threaded package installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# HF_HOME must NOT live under /data: that path is a named volume, and a volume
# mounts OVER image content, so a model baked at build time would be masked at
# runtime and silently re-downloaded (or, offline, fall back to regex-only).
# Model weights are immutable image content, not mutable state.
ENV PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1 \
    HF_HOME=/opt/hf \
    NER_MODEL=cahya/bert-base-indonesian-NER

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

# 1) Torch CPU-only via uv in its own layer (cached permanently)
RUN uv pip install torch --index-url https://download.pytorch.org/whl/cpu

# 2) Requirements via uv (cached)
RUN uv pip install -r requirements.txt

# 3) Bake the Indonesian NER model into the image (~440MB) so containers don't
#    fetch it on first request — a cold /mask would otherwise block on a
#    download, and an offline host would silently fall back to regex-only.
#    Deliberately unpinned: this repo's `main` carries only a .bin, which modern
#    transformers won't load, so the loader resolves model.safetensors from a PR
#    ref. Pinning revision="main" would break weight loading rather than
#    stabilise it. PII_REQUIRE_NER=1 is the safety net instead — see masker.py.
RUN python -c "from transformers import pipeline; pipeline('ner', model='${NER_MODEL}', aggregation_strategy='simple')"

COPY app.py masker.py prompts.py llm.py tools.py pasal_client.py test_masker.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

# No VOLUME: the node is stateless now. It used to persist a ChromaDB index at
# /data, but legal search moved to the pasal.id API and the model cache lives in
# /opt/hf. (docker-compose may still mount ai_node_data:/data; it will just sit
# there empty and can be removed with `docker volume rm pasalberapa_ai_node_data`.)
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
