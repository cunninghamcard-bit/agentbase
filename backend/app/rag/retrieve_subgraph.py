"""LangGraph retrieve subgraph: parallel dense/sparse → fuse → rerank
→ evaluate_quality → [conditional loop] expand_query.

Graph layout
────────────
    START
      │
      ├──► dense_retrieve ──┐
      │                       ├──► fuse ──► rerank ──► evaluate_quality
      └──► sparse_retrieve ─┘                          │
                                                       ▼
                                              ┌─────────────┐
                                              │ quality_gate │
                                              │  (conditional)│
                                              └─────────────┘
                                                    │
                                    ┌───────────────┴───────────────┐
                                    │ done                          │ retry
                                    ▼                               ▼
                                   END                         expand_query
                                                                     │
                                                                     ▼
                                                              回到 START

Each run of the loop increments `retry_count` and appends the expanded
query to `expanded_queries`.  The loop exits when quality is above the
threshold or `max_retrieve_retries` is exhausted.
"""
from __future__ import annotations

import logging
import time
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph

from app.config import settings
from app.rag import embedder, sparse as sparse_module, store
from app.rag.fusion import rrf
from app.rag.quality import evaluate_quality, quality_gate
from app.rag.rerank import rerank as cross_rerank

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Reducer for concurrent trace updates
# ---------------------------------------------------------------------------

def _merge_trace(left: dict, right: dict) -> dict:
    """Merge two trace dicts so parallel nodes can write to different keys."""
    merged = dict(left)
    for k, v in right.items():
        if k in merged and isinstance(merged[k], dict) and isinstance(v, dict):
            merged[k] = {**merged[k], **v}
        else:
            merged[k] = v
    return merged


# ---------------------------------------------------------------------------
# Subgraph State
# ---------------------------------------------------------------------------

class RetrieveState(TypedDict, total=False):
    """State flowing through the retrieve subgraph."""

    question: str              # current query (may be expanded)
    original_question: str     # untouched original
    expanded_queries: list[str]  # history of expansions

    dense_results: list[dict]
    sparse_results: list[dict]
    fused_results: list[dict]
    final_chunks: list[dict]

    quality_score: float
    retry_count: int

    trace: Annotated[dict, _merge_trace]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ensure_id(rows: list[dict]) -> list[dict]:
    for r in rows:
        if "id" not in r or not r["id"]:
            r["id"] = f"{r.get('source_id')}_{r.get('chunk_index')}"
    return rows


def _init_trace(state: RetrieveState) -> dict:
    return state.get("trace", {"timings_ms": {}, "counts": {}})


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def dense_retrieve_node(state: RetrieveState) -> dict:
    t0 = time.perf_counter()
    vec = embedder.embed_query(state["question"])
    results = _ensure_id(store.search(vec, top_k=settings.retrieval_top_k))

    trace = _init_trace(state)
    trace["timings_ms"]["dense"] = int((time.perf_counter() - t0) * 1000)
    trace["counts"]["dense"] = len(results)

    log.info("dense: %d hits in %d ms", len(results), trace["timings_ms"]["dense"])
    return {"dense_results": results, "trace": trace}


def sparse_retrieve_node(state: RetrieveState) -> dict:
    trace = _init_trace(state)
    if not sparse_module.exists():
        trace["counts"]["sparse"] = 0
        return {"sparse_results": [], "trace": trace}

    t0 = time.perf_counter()
    results = _ensure_id(sparse_module.search(state["question"], top_k=settings.retrieval_top_k))
    trace["timings_ms"]["sparse"] = int((time.perf_counter() - t0) * 1000)
    trace["counts"]["sparse"] = len(results)

    log.info("sparse: %d hits in %d ms", len(results), trace["timings_ms"]["sparse"])
    return {"sparse_results": results, "trace": trace}


def fuse_node(state: RetrieveState) -> dict:
    t0 = time.perf_counter()
    dense = state.get("dense_results", [])
    sparse_hits = state.get("sparse_results", [])

    if sparse_hits:
        fused = rrf([dense, sparse_hits], k=settings.rrf_k)
    else:
        fused = []
        for i, d in enumerate(dense):
            fd = dict(d)
            fd["rrf_score"] = 1.0 / (settings.rrf_k + i + 1)
            fd["retriever_sources"] = [0]
            fused.append(fd)

    fused = fused[: settings.rerank_candidates]

    trace = state.get("trace", {})
    trace["timings_ms"]["rrf"] = int((time.perf_counter() - t0) * 1000)
    trace["counts"]["rrf"] = len(fused)

    log.info("fuse: %d candidates in %d ms", len(fused), trace["timings_ms"]["rrf"])
    return {"fused_results": fused, "trace": trace}


def rerank_node(state: RetrieveState) -> dict:
    t0 = time.perf_counter()
    final = cross_rerank(state["question"], state["fused_results"], top_k=settings.rerank_top_k)

    trace = state.get("trace", {})
    trace["timings_ms"]["rerank"] = int((time.perf_counter() - t0) * 1000)
    trace["counts"]["final"] = len(final)

    log.info("rerank: %d chunks in %d ms", len(final), trace["timings_ms"]["rerank"])
    return {"final_chunks": final, "trace": trace}


def evaluate_quality_node(state: RetrieveState) -> dict:
    chunks = state.get("final_chunks", [])
    score = evaluate_quality(chunks)

    log.info("quality score=%.3f (threshold=%.2f, retry=%d/%d)",
             score, settings.quality_threshold,
             state.get("retry_count", 0), settings.max_retrieve_retries)
    return {"quality_score": score}


_EXPAND_PROMPT = """You are a query expansion assistant for an academic search engine.
The user asked: "{question}"

Previous expansion attempts: {history}

The current search returned low-confidence results.
Rewrite the query to be more specific, technical, and likely to match
academic papers or technical blog posts.  Output ONLY the rewritten
query, nothing else."""


def expand_query_node(state: RetrieveState) -> dict:
    """Use a lightweight LLM call to expand the query for retry."""
    history = state.get("expanded_queries", [])
    history_str = "; ".join(history) if history else "none"

    prompt = _EXPAND_PROMPT.format(question=state["question"], history=history_str)

    expanded = state["question"]  # fallback
    try:
        if settings.llm_provider == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=settings.llm_api_key, base_url=settings.llm_api_base)
            resp = client.messages.create(
                model=settings.llm_model,
                max_tokens=128,
                messages=[{"role": "user", "content": prompt}],
            )
            expanded = resp.content[0].text.strip()
        else:
            from openai import OpenAI
            client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_api_base)
            resp = client.chat.completions.create(
                model=settings.llm_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=128,
            )
            expanded = resp.choices[0].message.content.strip()
    except Exception as e:
        log.warning("query expansion failed (%s), keeping original", type(e).__name__)

    new_history = list(history)
    new_history.append(expanded)
    new_retry = state.get("retry_count", 0) + 1

    log.info("expanded query (attempt %d): %s", new_retry, expanded)
    return {
        "question": expanded,
        "expanded_queries": new_history,
        "retry_count": new_retry,
    }


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------

_retrieve_graph = None


def build_retrieve_subgraph():
    """Compile and return the retrieve StateGraph (parallel + retry loop)."""
    global _retrieve_graph
    if _retrieve_graph is not None:
        return _retrieve_graph

    builder = StateGraph(RetrieveState)

    builder.add_node("dense_retrieve", dense_retrieve_node)
    builder.add_node("sparse_retrieve", sparse_retrieve_node)
    builder.add_node("fuse", fuse_node)
    builder.add_node("rerank", rerank_node)
    builder.add_node("evaluate_quality", evaluate_quality_node)
    builder.add_node("expand_query", expand_query_node)

    # Parallel kick-off from START
    builder.add_edge(START, "dense_retrieve")
    builder.add_edge(START, "sparse_retrieve")

    # Both converge to fuse
    builder.add_edge("dense_retrieve", "fuse")
    builder.add_edge("sparse_retrieve", "fuse")

    # Sequential
    builder.add_edge("fuse", "rerank")
    builder.add_edge("rerank", "evaluate_quality")

    # Conditional: retry loop
    builder.add_conditional_edges(
        "evaluate_quality",
        quality_gate,
        {"retry": "expand_query", "done": END},
    )
    builder.add_edge("expand_query", "dense_retrieve")  # loop back

    _retrieve_graph = builder.compile()
    log.info("Retrieve subgraph compiled (parallel + retry loop)")
    return _retrieve_graph
