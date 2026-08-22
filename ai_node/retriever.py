"""
PasalBerapa? — Retriever (RAG)
==============================
Wrapper tipis di atas ChromaDB + embedding e5 Indonesia
(`LazarusNLP/all-indo-e5-small-v4`). Model & koleksi di-load lazy (singleton)
supaya start-up cepat dan hemat memori.
"""
import os
import logging
from typing import List, Dict

logger = logging.getLogger("pasalberapa.retriever")

CHROMA_PATH = os.environ.get("CHROMA_PATH", "/data/chroma")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "LazarusNLP/all-indo-e5-small-v4")
COLLECTION = os.environ.get("COLLECTION", "peraturan")

_model = None
_col = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("[retriever] memuat embedding model: %s", EMBED_MODEL)
        _model = SentenceTransformer(EMBED_MODEL)
    return _model


def get_collection():
    global _col
    if _col is None:
        import chromadb
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        _col = client.get_or_create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})
    return _col


def count() -> int:
    try:
        return get_collection().count()
    except Exception as e:
        logger.warning("[retriever] gagal menghitung koleksi: %s", e)
        return -1


def search(query: str, top_k: int = 6) -> List[Dict]:
    """Kembalikan daftar kutipan peraturan paling relevan.
    Format tiap item: {regulation, article, snippet, url, score}."""
    query = (query or "").strip()
    if not query:
        return []
    col = get_collection()
    if col.count() == 0:
        return []
    emb = get_model().encode([f"query: {query}"], normalize_embeddings=True).tolist()
    n = max(1, min(int(top_k), 20))
    res = col.query(query_embeddings=emb, n_results=n)
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]

    out: List[Dict] = []
    for doc, meta, dist in zip(docs, metas, dists):
        meta = meta or {}
        out.append({
            "regulation": meta.get("regulation", ""),
            "article": meta.get("article", ""),
            "snippet": doc,
            "url": meta.get("url", ""),
            "score": round(1 - float(dist), 4),
        })
    return out
