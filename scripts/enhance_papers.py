#!/usr/bin/env python3
"""Use LLM to extract structured info from arXiv papers (PDF -> structured markdown)."""
import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

import aiohttp

BASE_DIR = Path(__file__).resolve().parent.parent
META_PATH = BASE_DIR / "data" / "arxiv_metadata.jsonl"
PAPERS_DIR = BASE_DIR / "papers"
ENHANCED_DIR = BASE_DIR / "data" / "enhanced"
ENHANCED_DIR.mkdir(parents=True, exist_ok=True)

API_KEY = os.getenv("LLM_API_KEY", "")
API_BASE = os.getenv("LLM_API_BASE", "https://api.openai.com/v1")
MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

EXTRACTION_PROMPT = """You are an academic paper analyst. Given the title, authors, abstract, and (if available) full text of a paper, produce a structured summary in EXACTLY this format:

# Title: {title}
## Authors
{authors}
## Year
{year}
## Abstract
{abstract}
## Key Contributions
- Bullet 1
- Bullet 2
## Methods
{concise methods summary}
## Experiments
{concise experiments summary}
## Related Work
{concise related work summary}

Rules:
- Keep each section under 150 words.
- If any section is unknown, write "Not explicitly stated in the provided text."
- Output ONLY the markdown, no extra commentary.
"""


async def enhance_one(session: aiohttp.ClientSession, meta: dict) -> Path | None:
    paper_id = meta["arxiv_id"]
    out_path = ENHANCED_DIR / f"{paper_id}.md"
    if out_path.exists():
        return out_path

    title = meta.get("title", "")
    authors = ", ".join(meta.get("authors", []))
    year = meta.get("published", "")[:4]
    abstract = meta.get("abstract", "")

    content = f"Title: {title}\nAuthors: {authors}\nYear: {year}\nAbstract: {abstract}\n"

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": content},
        ],
        "temperature": 0.3,
    }
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

    try:
        async with session.post(f"{API_BASE}/chat/completions", json=payload, headers=headers) as resp:
            resp.raise_for_status()
            data = await resp.json()
            md = data["choices"][0]["message"]["content"]
            out_path.write_text(md, encoding="utf-8")
            print(f"  Enhanced {paper_id}")
            return out_path
    except Exception as e:
        print(f"  FAILED {paper_id}: {e}")
        return None


async def main():
    if not API_KEY:
        print("Error: set LLM_API_KEY env variable.")
        return

    records = []
    with open(META_PATH, "r", encoding="utf-8") as f:
        for line in f:
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                pass

    print(f"Found {len(records)} papers. Enhancing...")
    semaphore = asyncio.Semaphore(5)

    async def bounded_enhance(session, meta):
        async with semaphore:
            return await enhance_one(session, meta)

    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(*[bounded_enhance(session, r) for r in records])

    success = sum(1 for r in results if r)
    print(f"\nDone. Enhanced {success}/{len(records)} papers.")


if __name__ == "__main__":
    asyncio.run(main())
