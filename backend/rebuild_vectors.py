"""Rebuild LanceDB vector index from existing BM25 corpus metadata."""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.config import settings
from app.rag import embedder, store

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BATCH_SIZE = 64


def main():
    meta_path = settings.data_dir / "bm25" / "corpus_meta.json"
    if not meta_path.exists():
        log.error("BM25 corpus_meta.json not found at %s", meta_path)
        sys.exit(1)

    log.info("Loading corpus metadata from %s", meta_path)
    with open(meta_path, encoding="utf-8") as f:
        records = json.load(f)

    log.info("Total records to embed: %d", len(records))

    # Prepare LanceDB records
    lance_records = []
    texts = [r["text"] for r in records]

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        vectors = embedder.embed_texts(batch)
        for j, vec in enumerate(vectors):
            rec = records[i + j]
            lance_records.append({
                "id": rec["id"],
                "text": rec["text"],
                "vector": vec,
                "source_id": rec["source_id"],
                "source_type": rec["source_type"],
                "title": rec["title"],
                "chunk_index": rec["chunk_index"],
            })
        log.info("Embedded %d / %d chunks", min(i + BATCH_SIZE, len(texts)), len(texts))

    total = store.create_table(lance_records, mode="overwrite")
    log.info("Stored %d records in LanceDB", total)


if __name__ == "__main__":
    main()
