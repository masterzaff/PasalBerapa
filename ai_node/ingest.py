"""
Ingest a SUBSET of peraturan.go.id markdown into ChromaDB.
Uses git sparse-checkout to fetch only `embed_data.text/` (skips the multi-GB
.db/.faiss). Set INGEST_LIMIT to cap the number of documents.

Run:  python ingest.py
"""
import os
import re
import glob
import shutil
import subprocess
import chromadb
from sentence_transformers import SentenceTransformer

REPO = os.environ.get("REPO_URL", "https://github.com/Open-Technology-Foundation/peraturan.go.id")
WORK = os.environ.get("REPO_DIR", "/data/repo")
DATA_SUBDIR = os.environ.get("DATA_SUBDIR", "embed_data.text")
CHROMA_PATH = os.environ.get("CHROMA_PATH", "/data/chroma")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "LazarusNLP/all-indo-e5-small-v4")
COLLECTION = os.environ.get("COLLECTION", "peraturan")
INGEST_LIMIT = int(os.environ.get("INGEST_LIMIT", "500"))
# Model e5-small (LazarusNLP) max_seq_length ~128 token -> chunk kecil biar tak kepotong.
CHUNK = int(os.environ.get("CHUNK_CHARS", "480"))


def sparse_checkout():
    if os.path.isdir(os.path.join(WORK, DATA_SUBDIR)):
        print("[ingest] repo subset sudah ada, skip clone.")
        return
    if os.path.isdir(WORK):
        shutil.rmtree(WORK)
    print("[ingest] sparse-checkout", DATA_SUBDIR, "...")
    subprocess.run(["git", "clone", "--no-checkout", "--depth", "1", "--filter=blob:none", REPO, WORK], check=True)
    subprocess.run(["git", "-C", WORK, "sparse-checkout", "init", "--cone"], check=True)
    subprocess.run(["git", "-C", WORK, "sparse-checkout", "set", DATA_SUBDIR], check=True)
    subprocess.run(["git", "-C", WORK, "checkout"], check=True)


def chunk_text(text):
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    buf, out = "", []
    for p in paras:
        if len(buf) + len(p) + 1 > CHUNK:
            if buf:
                out.append(buf)
            buf = p
        else:
            buf = (buf + "\n" + p).strip()
    if buf:
        out.append(buf)
    return out


def meta_from(path, text):
    fname = os.path.basename(path)
    title = re.sub(r"[_\-]+", " ", os.path.splitext(fname)[0]).strip()
    lines = text.strip().splitlines()
    first = lines[0] if lines else ""
    if first and len(first) < 160:
        title = first.lstrip("# ").strip() or title
    m = re.search(r"https?://\S+", text)
    url = m.group(0) if m else ""
    art = re.search(r"Pasal\s+\d+", text)
    return {"regulation": title[:160], "url": url, "article": art.group(0) if art else ""}


def main():
    sparse_checkout()
    files = sorted(glob.glob(os.path.join(WORK, DATA_SUBDIR, "**", "*.md"), recursive=True))
    if INGEST_LIMIT > 0:
        files = files[:INGEST_LIMIT]
    print(f"[ingest] {len(files)} dokumen (limit={INGEST_LIMIT}).")

    model = SentenceTransformer(EMBED_MODEL)
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    try:
        client.delete_collection(COLLECTION)
    except Exception:
        pass
    col = client.get_or_create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})

    ids, docs, metas = [], [], []

    def flush():
        if not docs:
            return
        embs = model.encode([f"passage: {d}" for d in docs], normalize_embeddings=True, batch_size=64).tolist()
        col.add(ids=ids[:], documents=docs[:], embeddings=embs, metadatas=metas[:])
        ids.clear(); docs.clear(); metas.clear()

    for fi, path in enumerate(files):
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        base = meta_from(path, text)
        for ci, ch in enumerate(chunk_text(text)):
            ids.append(f"{fi}_{ci}")
            docs.append(ch)
            metas.append(base)
            if len(docs) >= 256:
                flush()
        if fi % 50 == 0:
            print(f"[ingest] {fi}/{len(files)} dok...")
    flush()
    print(f"[ingest] SELESAI. Total chunk: {col.count()}")


if __name__ == "__main__":
    main()
