"""LanceDB vector store wrapper."""
from __future__ import annotations

from pathlib import Path

import lancedb
import pyarrow as pa

from app.config import settings

TABLE_NAME = "chunks"

_db: lancedb.DBConnection | None = None


def get_db() -> lancedb.DBConnection:
    global _db
    if _db is None:
        _db = lancedb.connect(str(settings.db_path))
    return _db


def create_table(records: list[dict], mode: str = "overwrite") -> int:
    """Create or overwrite the chunks table.

    Each record: {id, text, vector, source_id, source_type, title, chunk_index}
    """
    db = get_db()

    if not records:
        return 0

    tbl = db.create_table(TABLE_NAME, data=records, mode=mode)
    return tbl.count_rows()


def table_exists() -> bool:
    db = get_db()
    return TABLE_NAME in db.table_names()


def count_rows() -> int:
    if not table_exists():
        return 0
    db = get_db()
    tbl = db.open_table(TABLE_NAME)
    return tbl.count_rows()


def search(query_vector: list[float], top_k: int = 20, source_type: str = "") -> list[dict]:
    """Vector similarity search. Returns list of dicts with text, source_id, title, _distance."""
    if not table_exists():
        return []

    db = get_db()
    tbl = db.open_table(TABLE_NAME)

    q = tbl.search(query_vector).limit(top_k)

    if source_type:
        q = q.where(f"source_type = '{source_type}'")

    results = q.to_list()

    return [
        {
            "text": r["text"],
            "source_id": r["source_id"],
            "source_type": r["source_type"],
            "title": r["title"],
            "chunk_index": r["chunk_index"],
            "score": 1.0 / (1.0 + r.get("_distance", 0)),
        }
        for r in results
    ]
