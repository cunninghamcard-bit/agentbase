"""Quality evaluation for retrieved chunks.

Heuristic: average rerank score of top chunks.  When the score is too low
it means the retriever found candidates but the cross-encoder is not
confident — a strong signal to expand the query and retry.
"""
from __future__ import annotations

from app.config import settings


def evaluate_quality(chunks: list[dict]) -> float:
    """Return a 0..1 quality score based on rerank confidence.

    - Uses the average rerank_score of the top-k chunks.
    - Falls back to RRF score average when rerank is disabled.
    - Empty result set → 0.0.
    """
    if not chunks:
        return 0.0

    scores = []
    for c in chunks:
        if "rerank_score" in c and c["rerank_score"] is not None:
            scores.append(float(c["rerank_score"]))
        elif "rrf_score" in c and c["rrf_score"] is not None:
            scores.append(min(float(c["rrf_score"]), 1.0))

    if not scores:
        return 0.0

    avg_score = sum(scores) / len(scores)
    # Normalise: cross-encoder raw scores are typically -5..5, squash to 0..1
    # with a sigmoid-like mapping centred at 0.
    from math import exp
    return 1.0 / (1.0 + exp(-avg_score))


def quality_gate(state: dict) -> str:
    """Return 'retry' or 'done' based on quality score and retry budget."""
    score = state.get("quality_score", 0.0)
    retries = state.get("retry_count", 0)

    if score >= settings.quality_threshold:
        return "done"
    if retries >= settings.max_retrieve_retries:
        return "done"  # exhausted budget, proceed with what we have
    return "retry"
