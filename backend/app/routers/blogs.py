import json
from functools import lru_cache

from fastapi import APIRouter, Query

from app.config import settings
from app.models import BlogItem, BlogList

router = APIRouter(tags=["blogs"])


@lru_cache(maxsize=1)
def _cached_blogs() -> list[dict]:
    path = settings.data_dir / "blog_metadata.jsonl"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


@router.get("/blogs", response_model=BlogList)
async def list_blogs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    q: str = Query("", description="Search title"),
    source: str = Query("", description="Filter by source"),
):
    blogs = _cached_blogs()

    if q:
        q_lower = q.lower()
        blogs = [b for b in blogs if q_lower in b.get("title", "").lower()]

    if source:
        blogs = [b for b in blogs if b.get("source") == source]

    total = len(blogs)
    start = (page - 1) * limit
    page_items = blogs[start : start + limit]

    return BlogList(
        items=[
            BlogItem(
                uid=b.get("uid", ""),
                source=b.get("source", ""),
                title=b.get("title", ""),
                link=b.get("link", ""),
                published=b.get("published", ""),
            )
            for b in page_items
        ],
        total=total,
        page=page,
        limit=limit,
    )
