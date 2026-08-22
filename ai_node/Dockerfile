FROM python:3.11-slim

# Copy the official uv binary for ultra-fast, multi-threaded package installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1 \
    HF_HOME=/data/hf \
    CHROMA_PATH=/data/chroma \
    EMBED_MODEL=LazarusNLP/all-indo-e5-small-v4 \
    SPACY_MODEL=xx_ent_wiki_sm \
    PII_LANG=id

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

# Torch CPU-only via uv (multi-threaded download with automatic retries) lalu requirements & spaCy NER model
RUN uv pip install torch --index-url https://download.pytorch.org/whl/cpu \
 && uv pip install -r requirements.txt \
 && uv pip install https://github.com/explosion/spacy-models/releases/download/xx_ent_wiki_sm-3.8.0/xx_ent_wiki_sm-3.8.0-py3-none-any.whl

COPY app.py masker.py retriever.py prompts.py llm.py ingest.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

VOLUME ["/data"]
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
