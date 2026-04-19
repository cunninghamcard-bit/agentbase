from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.models import ChatRequest, ContinueRequest
from app.rag.pipeline import rag_query, rag_query_continue, rag_query_debug

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat(
    req: ChatRequest,
    thread_id: str | None = Query(None, description="Resume an existing thread (optional)"),
):
    """RAG chat with SSE streaming.

    Stream events:
      {event: "node", node: "dense_retrieve", update: {...}}
      {event: "interrupt", action: "review", thread_id: "...", chunks: [...]}
      {event: "token", answer: "..."}
      {event: "done", answer: "...", references: [...]}
    """
    return StreamingResponse(
        rag_query(req.question, thread_id=thread_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/chat/continue")
async def chat_continue(req: ContinueRequest):
    """Resume a graph interrupted at human_review and stream LLM tokens.

    The client picks which chunks to keep via ``selected_indices`` and
    the graph resumes from the checkpoint, then feeds the selection into
    the LLM generate stream.
    """
    return StreamingResponse(
        rag_query_continue(req.thread_id, req.selected_indices),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/chat/debug")
async def chat_debug(req: ChatRequest):
    """Non-streaming. Returns full retrieval trace + top chunks for the
    Live Query Inspector UI. No LLM call — this endpoint is for inspecting
    retrieval behaviour, not for answering."""
    return await rag_query_debug(req.question)
