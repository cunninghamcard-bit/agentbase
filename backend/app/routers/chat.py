from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models import ChatRequest
from app.rag.pipeline import rag_query

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat(req: ChatRequest):
    """RAG chat with SSE streaming."""
    return StreamingResponse(
        rag_query(req.question),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
