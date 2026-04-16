"""Embedding wrapper using fastembed (local, no API needed)."""
from __future__ import annotations

import numpy as np
from fastembed import TextEmbedding

from app.config import settings

_model: TextEmbedding | None = None


def get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding(model_name=settings.embed_model)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns list of float vectors."""
    model = get_model()
    embeddings = list(model.embed(texts))
    return [e.tolist() for e in embeddings]


def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    model = get_model()
    embeddings = list(model.query_embed(query))
    return embeddings[0].tolist()
