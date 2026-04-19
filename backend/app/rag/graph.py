"""LangGraph main graph for AgentBase RAG.

Architecture
────────────
    ┌─────────────────────────────────────────────────────────────────┐
    │                         Main Graph                               │
    │                                                                   │
    │  START ──► init ──► retrieve (subgraph) ──► human_review ──► END │
    │                                                                   │
    └─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │   Retrieve Subgraph   │
                   │  (parallel + retry)   │
                   └──────────────────────┘

- Parallel dense / sparse retrieval via fan-out from START.
- Retry loop: evaluate_quality → expand_query → back to dense/sparse.
- Human-in-the-loop: `human_review` uses `interrupt()` to pause execution.
- Checkpoint: SQLite-backed so interrupted threads survive restarts.

The `generate` step is intentionally kept OUTSIDE the graph so that the
FastAPI layer can stream LLM tokens via SSE.  The graph stops at
`human_review`; after user confirmation pipeline.py calls generate_stream.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import TypedDict

import aiosqlite
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.config import settings
from app.rag.retrieve_subgraph import build_retrieve_subgraph

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class RAGState(TypedDict, total=False):
    """Shared state for the full RAG graph."""

    question: str
    original_question: str
    expanded_queries: list[str]

    dense_results: list[dict]
    sparse_results: list[dict]
    fused_results: list[dict]
    final_chunks: list[dict]
    selected_chunks: list[dict]

    quality_score: float
    retry_count: int

    answer: str
    references: list[dict]
    done: bool

    trace: dict


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def init_node(state: RAGState) -> dict:
    """Capture original question and init trace."""
    return {
        "original_question": state.get("question", ""),
        "expanded_queries": [],
        "retry_count": 0,
        "trace": {"timings_ms": {}, "counts": {}},
    }


def retrieve_node(state: RAGState) -> dict:
    """Run the parallel retrieve subgraph."""
    subgraph = build_retrieve_subgraph()
    result = subgraph.invoke(state)
    # Subgraph returns keys compatible with RAGState; merge them in.
    return {
        "dense_results": result.get("dense_results", []),
        "sparse_results": result.get("sparse_results", []),
        "fused_results": result.get("fused_results", []),
        "final_chunks": result.get("final_chunks", []),
        "quality_score": result.get("quality_score", 0.0),
        "retry_count": result.get("retry_count", 0),
        "expanded_queries": result.get("expanded_queries", []),
        "trace": result.get("trace", {}),
    }


def human_review_node(state: RAGState) -> dict:
    """Pause execution and ask the user (or auto-approve) to pick chunks.

    When `settings.auto_generate` is True we skip the interrupt and pass
    all chunks through unchanged.
    """
    chunks = state.get("final_chunks", [])

    if settings.auto_generate:
        log.info("auto_generate=True, skipping human review")
        return {"selected_chunks": chunks}

    # Interrupt: returns control to caller with the chunk list.
    # The caller resumes with Command(resume={"selected_indices": [...]}).
    result = interrupt({
        "action": "review",
        "chunks": [
            {
                "index": i,
                "id": c["id"],
                "title": c["title"],
                "source_type": c["source_type"],
                "rerank_score": c.get("rerank_score"),
                "text_preview": c["text"][:300],
            }
            for i, c in enumerate(chunks)
        ],
    })

    indices = result.get("selected_indices", list(range(len(chunks))))
    selected = [chunks[i] for i in indices if 0 <= i < len(chunks)]
    return {"selected_chunks": selected}


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------

_main_graph = None


async def build_main_graph():
    """Compile and return the main StateGraph with checkpointing."""
    global _main_graph
    if _main_graph is not None:
        return _main_graph

    builder = StateGraph(RAGState)

    builder.add_node("init", init_node)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("human_review", human_review_node)

    builder.add_edge(START, "init")
    builder.add_edge("init", "retrieve")
    builder.add_edge("retrieve", "human_review")
    builder.add_edge("human_review", END)

    db_path = Path(settings.checkpoint_db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = await aiosqlite.connect(str(db_path))
    saver = AsyncSqliteSaver(conn)

    _main_graph = builder.compile(checkpointer=saver)
    log.info("Main RAG graph compiled (checkpointed)")
    return _main_graph
