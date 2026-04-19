"""RAG pipeline: LangGraph orchestration with node-level SSE streaming.

Two modes:
  1. auto_generate=True  → graph runs to completion, then LLM streams tokens.
  2. auto_generate=False → graph pauses at human_review interrupt.

SSE Protocol (all events):
  {event: "node",     node: "dense_retrieve", update: {...}}
  {event: "interrupt", action: "review", thread_id: "...", chunks: [...]}
  {event: "token",    answer: "..."}          ← from generate_stream
  {event: "done",     answer: "...", references: [...]}
  [DONE]                                      ← stream terminator
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import AsyncGenerator

from langgraph.types import Command

from app.config import settings
from app.rag.graph import RAGState, build_main_graph

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def build_context(chunks: list[dict]) -> tuple[str, list[dict]]:
    parts: list[str] = []
    refs: list[dict] = []
    for i, c in enumerate(chunks, 1):
        label = "Paper" if c["source_type"] == "paper" else "Blog"
        parts.append(f"[{i}] ({label}: {c['title']})\n{c['text']}")
        refs.append({
            "index": i,
            "type": c["source_type"],
            "source_id": c["source_id"],
            "title": c["title"],
            "rerank_score": c.get("rerank_score"),
            "retriever_sources": c.get("retriever_sources", []),
        })
    return "\n\n".join(parts), refs


SYSTEM_PROMPT = """You are a research assistant for AI Agent topics. Answer based on the provided context from academic papers and technical blogs.

Rules:
- Use information from the context to answer.
- Cite sources using [1], [2] etc. matching the context numbers.
- If the context is insufficient, say so honestly — do not fabricate.
- Be concise and precise. Prefer specific claims with numbers over vague summaries.
- Write in English."""


async def generate_stream(
    question: str,
    context: str,
    references: list[dict],
) -> AsyncGenerator[str, None]:
    user_prompt = f"Context:\n{context}\n\nQuestion: {question}\n\nAnswer with citations [1][2] etc:"
    full_answer = ""

    if settings.llm_provider == "anthropic":
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.llm_api_key, base_url=settings.llm_api_base)
        async with client.messages.stream(
            model=settings.llm_model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        ) as stream:
            async for text in stream.text_stream:
                full_answer += text
                yield _sse({"event": "token", "answer": full_answer})
    else:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.llm_api_key, base_url=settings.llm_api_base)
        stream = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=2048,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_answer += delta
                yield _sse({"event": "token", "answer": full_answer})

    yield _sse({"event": "done", "answer": full_answer, "references": references})
    yield "data: [DONE]\n\n"


async def _stream_llm(question: str, selected_chunks: list[dict]) -> AsyncGenerator[str, None]:
    """Build context and stream LLM tokens."""
    if not selected_chunks:
        yield _sse({"event": "done", "answer": "No relevant documents found.", "references": []})
        yield "data: [DONE]\n\n"
        return

    context, references = build_context(selected_chunks)
    async for ev in generate_stream(question, context, references):
        yield ev


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

async def rag_query(
    question: str,
    thread_id: str | None = None,
) -> AsyncGenerator[str, None]:
    """Run the RAG graph with real-time node events via SSE.

    When auto_generate=True the graph runs straight through; after completion
    we stream LLM tokens.  When auto_generate=False the stream stops at the
    human_review interrupt and yields an ``interrupt`` event carrying
    ``thread_id``.  The caller must POST /chat/continue to resume.
    """
    graph = await build_main_graph()
    thread_id = thread_id or f"rag-{uuid.uuid4().hex[:12]}"
    config = {"configurable": {"thread_id": thread_id}}

    t0 = time.perf_counter()
    interrupted = False

    async for chunk in graph.astream({"question": question}, config):
        # LangGraph interrupt marker
        if "__interrupt__" in chunk:
            interrupted = True
            ir = chunk["__interrupt__"]
            payload = {
                "event": "interrupt",
                "action": ir[0].value.get("action") if ir else "review",
                "thread_id": thread_id,
                "chunks": ir[0].value.get("chunks", []) if ir else [],
            }
            yield _sse(payload)
            yield "data: [DONE]\n\n"
            return

        # Regular node output: {"node_name": {"field": value}}
        for node_name, update in chunk.items():
            # Sanitise update for JSON serialisation (drop heavy text fields)
            safe_update = _sanitise_update(node_name, update)
            yield _sse({
                "event": "node",
                "node": node_name,
                "update": safe_update,
            })

    total_ms = int((time.perf_counter() - t0) * 1000)
    log.info("graph completed in %d ms (interrupted=%s)", total_ms, interrupted)

    if interrupted:
        return

    # Graph finished — grab final state and stream LLM
    final_state = await graph.aget_state(config)
    values = final_state.values if hasattr(final_state, "values") else final_state
    selected = values.get("selected_chunks", values.get("final_chunks", []))
    q = values.get("question", question)

    async for ev in _stream_llm(q, selected):
        yield ev


async def rag_query_continue(
    thread_id: str,
    selected_indices: list[int],
) -> AsyncGenerator[str, None]:
    """Resume a graph interrupted at human_review and stream LLM tokens."""
    graph = await build_main_graph()
    config = {"configurable": {"thread_id": thread_id}}

    async for chunk in graph.astream(
        Command(resume={"selected_indices": selected_indices}),
        config,
    ):
        for node_name, update in chunk.items():
            safe_update = _sanitise_update(node_name, update)
            yield _sse({"event": "node", "node": node_name, "update": safe_update})

    final_state = await graph.aget_state(config)
    values = final_state.values if hasattr(final_state, "values") else final_state
    selected = values.get("selected_chunks", values.get("final_chunks", []))
    question = values.get("question", "")

    async for ev in _stream_llm(question, selected):
        yield ev


async def rag_query_debug(question: str) -> dict:
    """Non-streaming. Returns full retrieval trace + top chunks.

    Runs the graph in auto mode (skips human review) and extracts the
    retrieve-phase trace.
    """
    graph = await build_main_graph()
    thread_id = f"debug-{uuid.uuid4().hex[:12]}"
    config = {"configurable": {"thread_id": thread_id}}

    t0 = time.perf_counter()
    result = await graph.ainvoke({"question": question}, config)
    total_ms = int((time.perf_counter() - t0) * 1000)

    trace = result.get("trace", {})
    trace["total_ms"] = total_ms
    trace["quality_score"] = result.get("quality_score", 0.0)
    trace["retry_count"] = result.get("retry_count", 0)
    trace["expanded_queries"] = result.get("expanded_queries", [])

    top_chunks = result.get("final_chunks", [])
    return {
        "query": question,
        "trace": trace,
        "top_chunks": [
            {
                "id": c["id"],
                "source_id": c["source_id"],
                "source_type": c["source_type"],
                "title": c["title"],
                "chunk_index": c["chunk_index"],
                "rerank_score": c.get("rerank_score"),
                "rrf_score": c.get("rrf_score"),
                "retriever_sources": c.get("retriever_sources", []),
                "text_preview": c["text"][:400],
            }
            for c in top_chunks
        ],
    }


# ---------------------------------------------------------------------------
# Sanitisation helpers
# ---------------------------------------------------------------------------

def _sanitise_update(node_name: str, update: dict) -> dict:
    """Strip heavy text fields from node updates for JSON/SSE safety."""
    out = {}
    for k, v in update.items():
        if k in ("dense_results", "sparse_results", "fused_results", "final_chunks"):
            out[k] = _summarise_chunks(v)
        elif k == "trace":
            out[k] = v  # trace is already small
        elif k == "expanded_queries":
            out[k] = v
        elif k == "selected_chunks":
            out[k] = _summarise_chunks(v)
        elif k in ("answer", "references", "done"):
            out[k] = v
        else:
            out[k] = _truncate(v)
    return out


def _summarise_chunks(chunks: list[dict]) -> list[dict]:
    return [
        {
            "id": c.get("id"),
            "title": c.get("title"),
            "source_type": c.get("source_type"),
            "chunk_index": c.get("chunk_index"),
            "rerank_score": c.get("rerank_score"),
            "rrf_score": c.get("rrf_score"),
        }
        for c in chunks
    ]


def _truncate(value, maxlen: int = 500) -> str:
    s = str(value)
    return s if len(s) <= maxlen else s[:maxlen] + "..."
