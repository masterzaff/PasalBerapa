FROM python:3.11-slim

# Copy the official uv binary for ultra-fast, multi-threaded package installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1 \
    HF_HOME=/data/hf \
    CHROMA_PATH=/data/chroma \
    EMBED_MODEL=LazarusNLP/all-indo-e5-small-v4 \
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
RUN python -c "from transformers import pipeline; pipeline('ner', model='${NER_MODEL}', aggregation_strategy='simple')"

COPY app.py masker.py retriever.py prompts.py llm.py ingest.py tools.py pasal_client.py test_masker.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

VOLUME ["/data"]
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
