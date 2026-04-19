"""Cross-encoder rerank via fastembed's TextCrossEncoder.

Default model: Xenova/ms-marco-MiniLM-L-6-v2 (~23MB ONNX, fast on CPU).
Swap to BAAI/bge-reranker-v2-m3 via settings.rerank_model if you have the
compute for a ~568M param model.

Rerank turns hybrid retrieval's top-50 candidates into a higher-precision
top-k (typically 5–8) fed into the generator. It is the single highest-
leverage module in a modern RAG stack.
"""
from __future__ import annotations

import logging

from app.config import settings

log = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        from fastembed.rerank.cross_encoder import TextCrossEncoder
        _model = TextCrossEncoder(model_name=settings.rerank_model)
        log.info("Loaded cross-encoder: %s", settings.rerank_model)
    return _model


def rerank(query: str, candidates: list[dict], top_k: int | None = None) -> list[dict]:
    """Score each (query, candidate.text) pair and return top_k sorted desc.

    The returned dicts preserve all fields of the input candidates plus:
      - rerank_score: float relevance score from the cross-encoder
      - dense_rank / sparse_rank: preserved if present on input
    """
    if not candidates:
        return []
    top_k = top_k or settings.rerank_top_k

    if not settings.use_rerank:
        # still truncate to top_k so downstream sees consistent shape
        return candidates[:top_k]

    model = _get_model()
    scores = list(model.rerank(query, [c["text"] for c in candidates]))

    reranked = []
    for cand, score in zip(candidates, scores):
        d = dict(cand)
        d["rerank_score"] = float(score)
        reranked.append(d)
    reranked.sort(key=lambda d: -d["rerank_score"])
    return reranked[:top_k]
