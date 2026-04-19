"""Hybrid retrieval: dense + sparse + RRF fusion + cross-encoder rerank.

Pipeline:
    query
      ├─► Dense (fastembed → LanceDB)   top-N
      └─► Sparse (bm25s)                top-N
            │
            ▼
       RRF Fusion (k=60)     top-M candidates
            │
            ▼
     Cross-Encoder Rerank    top-K final (fed to LLM)
"""
from __future__ import annotations

import logging
import time

from app.config import settings
from app.rag import embedder, sparse, store
from app.rag.fusion import rrf
from app.rag.rerank import rerank as cross_rerank

log = logging.getLogger(__name__)


def _ensure_id(rows: list[dict]) -> list[dict]:
    """Add a stable id (`source_id_chunk_index`) if missing — matches ingest format."""
    for r in rows:
        if "id" not in r or not r["id"]:
            r["id"] = f"{r.get('source_id')}_{r.get('chunk_index')}"
    return rows


def dense_search(query: str, top_k: int) -> list[dict]:
    vec = embedder.embed_query(query)
    return _ensure_id(store.search(vec, top_k=top_k))


def sparse_search(query: str, top_k: int) -> list[dict]:
    return _ensure_id(sparse.search(query, top_k=top_k))


def retrieve(query: str) -> tuple[list[dict], dict]:
    """Return (final_chunks, trace).

    trace is a dict of timings_ms + per-retriever stats, used both for
    observability and for the /chat/debug inspector in the UI.
    """
    trace: dict = {"timings_ms": {}, "counts": {}}

    # 1. Dense
    t0 = time.perf_counter()
    dense = dense_search(query, settings.retrieval_top_k)
    trace["timings_ms"]["dense"] = int((time.perf_counter() - t0) * 1000)
    trace["counts"]["dense"] = len(dense)

    # 2. Sparse (optional — when index missing we degrade to dense-only)
    sparse_hits: list[dict] = []
    if settings.use_hybrid and sparse.exists():
        t0 = time.perf_counter()
        sparse_hits = sparse_search(query, settings.retrieval_top_k)
        trace["timings_ms"]["sparse"] = int((time.perf_counter() - t0) * 1000)
        trace["counts"]["sparse"] = len(sparse_hits)

    # 3. RRF fuse
    t0 = time.perf_counter()
    if sparse_hits:
        fused = rrf([dense, sparse_hits], k=settings.rrf_k)
    else:
        fused = _ensure_id(dense)
        for i, d in enumerate(fused):
            d["rrf_score"] = 1.0 / (settings.rrf_k + i + 1)
            d["retriever_sources"] = [0]
    fused = fused[: settings.rerank_candidates]
    trace["timings_ms"]["rrf"] = int((time.perf_counter() - t0) * 1000)
    trace["counts"]["rrf"] = len(fused)

    # 4. Cross-encoder rerank
    t0 = time.perf_counter()
    final = cross_rerank(query, fused, top_k=settings.rerank_top_k)
    trace["timings_ms"]["rerank"] = int((time.perf_counter() - t0) * 1000)
    trace["counts"]["final"] = len(final)

    trace["top_ids"] = [d["id"] for d in final]
    return final, trace
