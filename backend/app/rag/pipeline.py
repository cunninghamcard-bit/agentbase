"""RAG pipeline: retrieve → rerank → generate with citations."""
from __future__ import annotations

import json
from collections.abc import AsyncGenerator

from app.config import settings
from app.rag import embedder, store


def retrieve(query: str, top_k: int | None = None) -> list[dict]:
    """Embed query and search vector store."""
    top_k = top_k or settings.retrieval_top_k
    query_vec = embedder.embed_query(query)
    results = store.search(query_vec, top_k=top_k)
    return results


def rerank(results: list[dict], top_k: int | None = None) -> list[dict]:
    """Simple reranking by score (already sorted by LanceDB distance)."""
    top_k = top_k or settings.rerank_top_k
    # Deduplicate by source_id + chunk_index
    seen = set()
    unique = []
    for r in results:
        key = (r["source_id"], r["chunk_index"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return sorted(unique, key=lambda x: x["score"], reverse=True)[:top_k]


def build_context(chunks: list[dict]) -> tuple[str, list[dict]]:
    """Build context string with numbered citations."""
    context_parts = []
    references = []

    for i, chunk in enumerate(chunks, 1):
        source_label = "Paper" if chunk["source_type"] == "paper" else "Blog"
        context_parts.append(f"[{i}] ({source_label}: {chunk['title']})\n{chunk['text']}")
        references.append({
            "index": i,
            "type": chunk["source_type"],
            "source_id": chunk["source_id"],
            "title": chunk["title"],
        })

    return "\n\n".join(context_parts), references


SYSTEM_PROMPT = """You are a research assistant for AI Agent topics. Answer the user's question based on the provided context from academic papers and technical blogs.

Rules:
- Use information from the provided context to answer.
- Cite sources using [1], [2] etc. corresponding to the context numbers.
- If the context doesn't contain enough information, say so honestly.
- Be concise and precise. Prefer specific claims over vague summaries.
- Write in English."""


async def generate_stream(
    question: str,
    context: str,
    references: list[dict],
) -> AsyncGenerator[str, None]:
    """Stream LLM response as SSE events, compatible with frontend protocol."""

    user_prompt = f"""Context:
{context}

Question: {question}

Answer with citations [1][2] etc:"""

    full_answer = ""

    if settings.llm_provider == "anthropic":
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=settings.llm_api_key)
        async with client.messages.stream(
            model=settings.llm_model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        ) as stream:
            async for text in stream.text_stream:
                full_answer += text
                payload = json.dumps({"data": {"answer": full_answer}})
                yield f"data: {payload}\n\n"
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
                payload = json.dumps({"data": {"answer": full_answer}})
                yield f"data: {payload}\n\n"

    # Final event with references
    final = json.dumps({
        "data": {"answer": full_answer, "references": references, "done": True}
    })
    yield f"data: {final}\n\n"
    yield "data: [DONE]\n\n"


async def rag_query(question: str) -> AsyncGenerator[str, None]:
    """Full RAG pipeline: retrieve → rerank → generate."""
    # Retrieve
    results = retrieve(question)

    if not results:
        payload = json.dumps({
            "data": {"answer": "No relevant documents found. Please run data ingestion first (POST /api/ingest)."}
        })
        yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"
        return

    # Rerank
    top_chunks = rerank(results)

    # Build context
    context, references = build_context(top_chunks)

    # Generate (with fallback if LLM is unavailable)
    try:
        async for event in generate_stream(question, context, references):
            yield event
    except Exception as e:
        # Fallback: return retrieval results directly
        fallback = f"**[LLM unavailable: {type(e).__name__}]**\n\nRetrieved context for your question:\n\n"
        for i, chunk in enumerate(top_chunks, 1):
            label = "Paper" if chunk["source_type"] == "paper" else "Blog"
            fallback += f"**[{i}] {chunk['title']}** ({label})\n{chunk['text'][:300]}...\n\n"
        payload = json.dumps({"data": {"answer": fallback, "references": references}})
        yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"
