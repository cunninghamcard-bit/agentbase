"""Sparse BM25 index sidecar, via xhluca/bm25s.

Why bm25s (not rank_bm25 / whoosh):
- Pure numpy + scipy sparse, no JVM, no C compile.
- ~100× faster than rank_bm25 on indexing and query (see project benchmarks).
- Persists to disk as a directory we can reload in-process.

This is the "sparse" leg of hybrid retrieval. Dense leg lives in rag/store.py.
"""
from __future__ import annotations

import json
from pathlib import Path

import bm25s

from app.config import settings


_index: bm25s.BM25 | None = None
_corpus_meta: list[dict] | None = None


def _meta_path() -> Path:
    return settings.bm25_path / "corpus_meta.json"


def build(records: list[dict]) -> int:
    """Tokenize texts and persist a BM25 index + metadata sidecar.

    records: same shape as embed_and_store uses:
             {id, text, source_id, source_type, title, chunk_index}
    """
    if not records:
        return 0

    settings.bm25_path.mkdir(parents=True, exist_ok=True)

    corpus = [r["text"] for r in records]
    tokens = bm25s.tokenize(corpus, stopwords="en", show_progress=False)

    retriever = bm25s.BM25()
    retriever.index(tokens, show_progress=False)
    retriever.save(str(settings.bm25_path))

    meta = [
        {
            "id": r["id"],
            "source_id": r["source_id"],
            "source_type": r["source_type"],
            "title": r["title"],
            "chunk_index": r["chunk_index"],
            "text": r["text"],
        }
        for r in records
    ]
    _meta_path().write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    # reset cache
    global _index, _corpus_meta
    _index = None
    _corpus_meta = None
    return len(records)


def _load() -> tuple[bm25s.BM25, list[dict]] | None:
    global _index, _corpus_meta
    if _index is not None and _corpus_meta is not None:
        return _index, _corpus_meta
    mpath = _meta_path()
    if not mpath.exists():
        return None
    _index = bm25s.BM25.load(str(settings.bm25_path), load_corpus=False)
    _corpus_meta = json.loads(mpath.read_text(encoding="utf-8"))
    return _index, _corpus_meta


def exists() -> bool:
    return _load() is not None


def count() -> int:
    loaded = _load()
    return len(loaded[1]) if loaded else 0


def search(query: str, top_k: int = 20) -> list[dict]:
    """Return top_k hits with fields: text, source_id, source_type, title,
    chunk_index, score, id. Score is raw BM25 score (higher = better)."""
    loaded = _load()
    if loaded is None:
        return []
    retriever, meta = loaded
    q_tokens = bm25s.tokenize([query], stopwords="en", show_progress=False)
    docs, scores = retriever.retrieve(q_tokens, k=min(top_k, len(meta)), show_progress=False)
    # docs/scores shape: (1, k)  — docs are integer corpus indices
    out: list[dict] = []
    for idx, sc in zip(docs[0].tolist(), scores[0].tolist()):
        m = meta[idx]
        out.append({
            **m,
            "score": float(sc),
        })
    return out
