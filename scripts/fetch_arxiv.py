#!/usr/bin/env python3
"""Fetch AI-Agent related papers from arXiv."""
import json
import os
import time
from datetime import datetime
from pathlib import Path

import arxiv

BASE_DIR = Path(__file__).resolve().parent.parent
PAPERS_DIR = BASE_DIR / "papers"
META_PATH = BASE_DIR / "data" / "arxiv_metadata.jsonl"

PAPERS_DIR.mkdir(parents=True, exist_ok=True)
META_PATH.parent.mkdir(parents=True, exist_ok=True)

# Search queries for Agent-related topics
QUERIES = [
    "cat:cs.AI AND (agent OR \"multi-agent\")",
    "cat:cs.AI AND (\"llm reasoning\" OR \"chain of thought\" OR ReAct)",
    "cat:cs.AI AND (\"tool use\" OR \"tool learning\" OR ToolFormer)",
    "cat:cs.CL AND (agent OR \"multi-agent\")",
]

MAX_PER_QUERY = 150  # total ~600 papers


def load_existing_ids() -> set:
    """Load already downloaded arXiv IDs to avoid duplicates."""
    existing = set()
    if META_PATH.exists():
        with open(META_PATH, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    existing.add(json.loads(line)["arxiv_id"])
                except (KeyError, json.JSONDecodeError):
                    pass
    return existing


def main():
    client = arxiv.Client(num_retries=5, delay_seconds=3)
    existing_ids = load_existing_ids()
    print(f"Already have {len(existing_ids)} papers. Fetching more...")

    fetched = 0
    for query in QUERIES:
        search = arxiv.Search(
            query=query,
            max_results=MAX_PER_QUERY,
            sort_by=arxiv.SortCriterion.SubmittedDate,
        )
        for paper in client.results(search):
            paper_id = paper.get_short_id().split("v")[0]
            if paper_id in existing_ids:
                continue

            pdf_path = PAPERS_DIR / f"{paper_id}.pdf"
            try:
                paper.download_pdf(dirpath=str(PAPERS_DIR), filename=f"{paper_id}.pdf")
            except Exception as e:
                print(f"  Failed to download {paper_id}: {e}")
                continue

            meta = {
                "arxiv_id": paper_id,
                "title": paper.title,
                "authors": [a.name for a in paper.authors],
                "abstract": paper.summary,
                "published": paper.published.isoformat(),
                "updated": paper.updated.isoformat(),
                "primary_category": paper.primary_category,
                "categories": paper.categories,
                "pdf_url": paper.pdf_url,
                "entry_id": paper.entry_id,
                "query": query,
                "downloaded_at": datetime.utcnow().isoformat(),
            }
            with open(META_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(meta, ensure_ascii=False) + "\n")

            existing_ids.add(paper_id)
            fetched += 1
            print(f"[{fetched}] {paper_id} | {paper.title[:60]}...")
            time.sleep(0.5)

    print(f"\nDone. Fetched {fetched} new papers. Total: {len(existing_ids)}")


if __name__ == "__main__":
    main()
