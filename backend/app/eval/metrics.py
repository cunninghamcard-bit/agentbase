"""Retrieval metrics: Recall@k, MRR, NDCG@k.

Ground truth format (golden.jsonl):
    {"query": "...", "relevant_ids": ["arxivid:chunkidx", ...]}

Predicted format: a list of ids in rank order (best first).
"""
from __future__ import annotations

import math


def hit_at_k(predicted: list[str], relevant: set[str], k: int) -> float:
    """Binary — did any relevant doc land in top-k. Right metric when each
    query has many relevant chunks (e.g. any chunk of the target paper counts)."""
    return 1.0 if any(p in relevant for p in predicted[:k]) else 0.0


def recall_at_k(predicted: list[str], relevant: set[str], k: int) -> float:
    """Proper Recall@k capped by min(k, |relevant|) — avoids the pathology
    where a 100-chunk paper forces Recall@10 ≤ 0.1 by construction."""
    if not relevant:
        return 0.0
    hits = sum(1 for p in predicted[:k] if p in relevant)
    denom = min(k, len(relevant))
    return hits / denom if denom else 0.0


def mrr(predicted: list[str], relevant: set[str]) -> float:
    for rank, p in enumerate(predicted, 1):
        if p in relevant:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(predicted: list[str], relevant: set[str], k: int) -> float:
    dcg = 0.0
    for rank, p in enumerate(predicted[:k], 1):
        if p in relevant:
            dcg += 1.0 / math.log2(rank + 1)
    # ideal DCG: all relevant docs are at the top
    ideal_hits = min(len(relevant), k)
    idcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    return dcg / idcg if idcg > 0 else 0.0


def aggregate(results: list[dict]) -> dict:
    """results: [{recall@5, recall@10, mrr, ndcg@10}, ...] → means."""
    if not results:
        return {}
    keys = results[0].keys()
    return {k: sum(r[k] for r in results) / len(results) for k in keys}
