"""Reciprocal Rank Fusion.

Reference: Cormack, Clarke, Buettcher (SIGIR 2009).
    score(d) = Σ_i 1 / (k + rank_i(d))

Picks k=60 by default — the value from the original paper, also used by
Elasticsearch / Weaviate in their hybrid implementations.
"""
from __future__ import annotations


def rrf(ranked_lists: list[list[dict]], k: int = 60, id_key: str = "id") -> list[dict]:
    """Fuse multiple ranked lists of dicts by reciprocal rank.

    Each input list is assumed already sorted best-first. Ties broken by
    first-seen. The per-list scale (cosine vs BM25) does NOT matter — RRF
    operates on ranks, which is the whole point.
    """
    scores: dict[str, float] = {}
    first_seen: dict[str, dict] = {}
    sources: dict[str, set[int]] = {}

    for list_idx, lst in enumerate(ranked_lists):
        for rank, doc in enumerate(lst):
            doc_id = doc.get(id_key) or f"{doc.get('source_id')}:{doc.get('chunk_index')}"
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
            if doc_id not in first_seen:
                first_seen[doc_id] = doc
            sources.setdefault(doc_id, set()).add(list_idx)

    fused = []
    for doc_id, score in sorted(scores.items(), key=lambda x: -x[1]):
        d = dict(first_seen[doc_id])
        d["rrf_score"] = score
        d["retriever_sources"] = sorted(sources[doc_id])  # e.g. [0] dense, [1] sparse, [0,1] both
        fused.append(d)
    return fused
