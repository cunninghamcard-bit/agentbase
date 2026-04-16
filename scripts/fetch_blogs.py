#!/usr/bin/env python3
"""Fetch AI blogs via RSS / simple crawling, clean to Markdown."""
import asyncio
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import aiohttp
import feedparser
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent.parent
BLOGS_DIR = BASE_DIR / "blogs"
META_PATH = BASE_DIR / "data" / "blog_metadata.jsonl"

BLOGS_DIR.mkdir(parents=True, exist_ok=True)
META_PATH.parent.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "lilianweng": {
        "type": "rss",
        "url": "https://lilianweng.github.io/index.xml",
    },
    "google_research": {
        "type": "rss",
        "url": "http://localhost:1200/google/research",
    },
    "openai": {
        "type": "rss",
        "url": "https://openai.com/news/rss.xml",
        "use_jina": True,
    },
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AgentBaseBot/1.0)",
}


def slugify(text: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in text)[:80]


async def fetch(session: aiohttp.ClientSession, url: str, use_jina: bool = False) -> str:
    target = f"https://r.jina.ai/http://{url.replace('https://', '').replace('http://', '')}" if use_jina else url
    async with session.get(target, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=60)) as resp:
        resp.raise_for_status()
        return await resp.text()


def html_to_md(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    article = soup.find("article") or soup.find("main") or soup.find("div", role="main")
    text = (article or soup).get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n\n".join(lines)


async def process_rss(session: aiohttp.ClientSession, source_name: str, cfg: dict, existing: set):
    fetched = 0
    use_jina = cfg.get("use_jina", False)
    try:
        xml = await fetch(session, cfg["url"])
    except Exception as e:
        print(f"  [{source_name}] FAILED to fetch RSS {cfg['url']}: {e}")
        return 0

    feed = feedparser.parse(xml)
    for entry in feed.entries:
        title = entry.get("title", "Untitled")
        link = entry.get("link", "")
        uid = hashlib.md5(link.encode()).hexdigest()[:12]
        if uid in existing:
            continue

        try:
            raw = await fetch(session, link, use_jina=use_jina)
            md = html_to_md(raw)
        except Exception as e:
            print(f"  [{source_name}] Failed {link}: {e}")
            continue

        fname = f"{source_name}_{uid}_{slugify(title)}.md"
        (BLOGS_DIR / fname).write_text(md, encoding="utf-8")

        meta = {
            "uid": uid,
            "source": source_name,
            "title": title,
            "link": link,
            "published": entry.get("published", ""),
            "fname": fname,
            "downloaded_at": datetime.now(timezone.utc).isoformat(),
        }
        with open(META_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(meta, ensure_ascii=False) + "\n")
        existing.add(uid)
        fetched += 1
        print(f"  [{source_name}] +{fetched} {title[:60]}...")
    return fetched


async def main():
    existing = set()
    if META_PATH.exists():
        with open(META_PATH, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    existing.add(json.loads(line)["uid"])
                except Exception:
                    pass
    print(f"Existing blogs: {len(existing)}")

    async with aiohttp.ClientSession() as session:
        tasks = []
        for name, cfg in SOURCES.items():
            if cfg["type"] == "rss":
                tasks.append(process_rss(session, name, cfg, existing))
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                print(f"Source crashed: {r}")

    success = sum(r for r in results if isinstance(r, int))
    print(f"\nDone. Fetched {success} new blogs.")


if __name__ == "__main__":
    asyncio.run(main())
