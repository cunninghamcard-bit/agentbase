"""Load papers/blogs, chunk, embed, and store in LanceDB."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import settings
from app.ingest.pdf import extract_text
from app.rag.chunker import Chunk, chunk_text, chunk_by_sections
from app.rag import embedder, store, sparse

log = logging.getLogger(__name__)

BATCH_SIZE = 64  # embedding batch size


def load_paper_metadata() -> list[dict]:
    path = settings.data_dir / "arxiv_metadata.jsonl"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def load_blog_metadata() -> list[dict]:
    path = settings.data_dir / "blog_metadata.jsonl"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def ingest_papers() -> list[Chunk]:
    """Read PDFs, extract text, chunk."""
    metas = load_paper_metadata()
    all_chunks: list[Chunk] = []

    for meta in metas:
        arxiv_id = meta["arxiv_id"]
        pdf_path = settings.papers_dir / f"{arxiv_id}.pdf"

        if not pdf_path.exists():
            continue

        try:
            text = extract_text(pdf_path)
        except Exception as e:
            log.warning("Failed to extract %s: %s", arxiv_id, e)
            continue

        if len(text.strip()) < 100:
            continue

        chunks = chunk_by_sections(
            text,
            source_id=arxiv_id,
            source_type="paper",
            title=meta.get("title", arxiv_id),
            max_tokens=settings.chunk_size,
            overlap=settings.chunk_overlap,
        )
        all_chunks.extend(chunks)

    log.info("Papers: %d files → %d chunks", len(metas), len(all_chunks))
    return all_chunks


def ingest_blogs() -> list[Chunk]:
    """Read blog markdown files, chunk."""
    metas = load_blog_metadata()
    all_chunks: list[Chunk] = []

    for meta in metas:
        fname = meta.get("fname", "")
        blog_path = settings.blogs_dir / fname

        if not blog_path.exists():
            continue

        text = blog_path.read_text(encoding="utf-8")
        if len(text.strip()) < 100:
            continue

        chunks = chunk_text(
            text,
            source_id=meta.get("uid", fname),
            source_type="blog",
            title=meta.get("title", fname),
            max_tokens=settings.chunk_size,
            overlap=settings.chunk_overlap,
        )
        all_chunks.extend(chunks)

    log.info("Blogs: %d files → %d chunks", len(metas), len(all_chunks))
    return all_chunks


def embed_and_store(chunks: list[Chunk]) -> int:
    """Embed all chunks and write to LanceDB."""
    if not chunks:
        return 0

    records = []
    texts = [c.text for c in chunks]

    # Batch embed
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        vectors = embedder.embed_texts(batch)
        for j, vec in enumerate(vectors):
            c = chunks[i + j]
            records.append({
                "id": f"{c.source_id}_{c.chunk_index}",
                "text": c.text,
                "vector": vec,
                "source_id": c.source_id,
                "source_type": c.source_type,
                "title": c.title,
                "chunk_index": c.chunk_index,
            })

        log.info("Embedded %d / %d chunks", min(i + BATCH_SIZE, len(texts)), len(texts))

    total = store.create_table(records, mode="overwrite")
    sparse.build(records)
    log.info("Stored %d records in LanceDB + BM25 sidecar", total)
    return total


def run_ingest(source: str = "all") -> dict:
    """Full ingest pipeline."""
    chunks: list[Chunk] = []
    papers_count = 0
    blogs_count = 0

    if source in ("papers", "all"):
        paper_chunks = ingest_papers()
        papers_count = len(paper_chunks)
        chunks.extend(paper_chunks)

    if source in ("blogs", "all"):
        blog_chunks = ingest_blogs()
        blogs_count = len(blog_chunks)
        chunks.extend(blog_chunks)

    total = embed_and_store(chunks)

    return {
        "status": "completed",
        "papers_chunked": papers_count,
        "blogs_chunked": blogs_count,
        "total_chunks": total,
    }
