import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Query

from app.config import settings
from app.models import PaperItem, PaperList

router = APIRouter(tags=["papers"])


def _load_papers() -> list[dict]:
    path = settings.data_dir / "arxiv_metadata.jsonl"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


@lru_cache(maxsize=1)
def _cached_papers() -> list[dict]:
    return _load_papers()


def _invalidate():
    _cached_papers.cache_clear()


@router.get("/papers", response_model=PaperList)
async def list_papers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    q: str = Query("", description="Search title/abstract"),
    category: str = Query("", description="Filter by primary_category"),
):
    papers = _cached_papers()

    if q:
        q_lower = q.lower()
        papers = [
            p for p in papers
            if q_lower in p.get("title", "").lower()
            or q_lower in p.get("abstract", "").lower()
        ]

    if category:
        papers = [p for p in papers if p.get("primary_category") == category]

    # Sort by published date descending
    papers.sort(key=lambda p: p.get("published", ""), reverse=True)

    total = len(papers)
    start = (page - 1) * limit
    page_items = papers[start : start + limit]

    return PaperList(
        items=[
            PaperItem(
                arxiv_id=p["arxiv_id"],
                title=p["title"],
                authors=p.get("authors", []),
                abstract=p.get("abstract", ""),
                published=p.get("published", ""),
                primary_category=p.get("primary_category", ""),
                pdf_url=p.get("pdf_url", ""),
            )
            for p in page_items
        ],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/papers/{arxiv_id}")
async def get_paper(arxiv_id: str):
    papers = _cached_papers()
    for p in papers:
        if p["arxiv_id"] == arxiv_id:
            return p
    return {"error": "not found"}
