"""Eval runner — measure retrieval quality on the golden set.

Usage:
    cd backend && uv run python -m app.eval.run
    cd backend && uv run python -m app.eval.run --baseline  # dense-only, no rerank

Output: prints a table and writes JSON report to data/eval_report.json.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.config import settings
from app.eval.metrics import aggregate, hit_at_k, mrr, ndcg_at_k, recall_at_k
from app.rag import embedder, sparse, store
from app.rag.fusion import rrf
from app.rag.rerank import rerank as cross_rerank


GOLDEN_PATH = Path(__file__).parent / "golden.jsonl"
REPORT_PATH_DEFAULT = settings.data_dir / "eval_report.json"


def load_golden() -> list[dict]:
    return [json.loads(line) for line in GOLDEN_PATH.read_text().splitlines() if line.strip()]


def ensure_id(rows: list[dict]) -> list[dict]:
    for r in rows:
        if "id" not in r:
            r["id"] = f"{r.get('source_id')}_{r.get('chunk_index')}"
    return rows


def run_query(query: str, baseline: bool) -> list[str]:
    """Return predicted ids (rank order). baseline = dense-only, no rerank."""
    vec = embedder.embed_query(query)
    dense = ensure_id(store.search(vec, top_k=settings.retrieval_top_k))

    if baseline:
        return [d["id"] for d in dense]

    # Hybrid
    sparse_hits = ensure_id(sparse.search(query, top_k=settings.retrieval_top_k)) if sparse.exists() else []
    fused = rrf([dense, sparse_hits], k=settings.rrf_k) if sparse_hits else dense
    fused = fused[: settings.rerank_candidates]
    final = cross_rerank(query, fused, top_k=settings.rerank_top_k)
    return [d["id"] for d in final]


def evaluate(baseline: bool = False) -> dict:
    golden = load_golden()
    per_query: list[dict] = []

    for item in golden:
        q, rel = item["query"], set(item["relevant_ids"])
        pred = run_query(q, baseline=baseline)
        per_query.append({
            "hit@5":     hit_at_k(pred, rel, 5),
            "hit@10":    hit_at_k(pred, rel, 10),
            "recall@5":  recall_at_k(pred, rel, 5),
            "recall@10": recall_at_k(pred, rel, 10),
            "mrr":       mrr(pred, rel),
            "ndcg@10":   ndcg_at_k(pred, rel, 10),
        })

    return {
        "mode": "baseline (dense top-k)" if baseline else "agentbase (hybrid + rerank)",
        "n_queries": len(golden),
        "metrics": aggregate(per_query),
        "per_query": per_query,
    }


def fmt(metrics: dict) -> str:
    return " · ".join(f"{k}={v:.3f}" for k, v in metrics.items())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", action="store_true", help="dense-only, skip RRF + rerank")
    ap.add_argument("--both", action="store_true", help="run both and compare")
    ap.add_argument("--report", type=Path, default=REPORT_PATH_DEFAULT)
    args = ap.parse_args()

    reports: list[dict] = []
    if args.both:
        reports.append(evaluate(baseline=True))
        reports.append(evaluate(baseline=False))
    else:
        reports.append(evaluate(baseline=args.baseline))

    for r in reports:
        print(f"\n[{r['mode']}] n={r['n_queries']}")
        print("  " + fmt(r["metrics"]))

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(reports, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {args.report}")


if __name__ == "__main__":
    main()
