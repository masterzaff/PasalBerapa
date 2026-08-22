FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/data/hf \
    CHROMA_PATH=/data/chroma \
    EMBED_MODEL=LazarusNLP/all-indo-e5-small-v4 \
    SPACY_MODEL=xx_ent_wiki_sm \
    PII_LANG=id

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# Torch CPU-only (lebih kecil) lalu sisanya. Terakhir, model NER multilingual.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements.txt \
 && python -m spacy download xx_ent_wiki_sm

COPY app.py masker.py retriever.py prompts.py llm.py ingest.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

VOLUME ["/data"]
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
