import asyncio
import logging

from fastapi import APIRouter

from app.models import IngestRequest, IngestResponse
from app.rag import store

router = APIRouter(tags=["ingest"])

log = logging.getLogger(__name__)


@router.post("/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest):
    """Run data ingestion in a thread pool so it doesn't block the event loop."""
    from app.ingest.loader import run_ingest

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, run_ingest, req.source)
    return IngestResponse(**result)


@router.get("/stats")
async def stats():
    """Corpus statistics."""
    from app.routers.papers import _cached_papers
    from app.routers.blogs import _cached_blogs

    return {
        "papers": len(_cached_papers()),
        "blogs": len(_cached_blogs()),
        "chunks": store.count_rows(),
        "indexed": store.table_exists(),
    }
