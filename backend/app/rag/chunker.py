"""Document chunking: split papers and blogs into retrieval-sized pieces."""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Chunk:
    text: str
    source_id: str
    source_type: str  # "paper" or "blog"
    title: str
    chunk_index: int


def chunk_text(
    text: str,
    source_id: str,
    source_type: str,
    title: str,
    max_tokens: int = 500,
    overlap: int = 50,
) -> list[Chunk]:
    """Split text into overlapping chunks of approximately max_tokens words."""
    # Clean whitespace
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []

    words = text.split()
    chunks: list[Chunk] = []
    start = 0
    idx = 0

    while start < len(words):
        end = min(start + max_tokens, len(words))
        chunk_text = " ".join(words[start:end])

        if len(chunk_text.strip()) > 20:  # skip tiny fragments
            chunks.append(Chunk(
                text=chunk_text,
                source_id=source_id,
                source_type=source_type,
                title=title,
                chunk_index=idx,
            ))
            idx += 1

        start = end - overlap if end < len(words) else len(words)

    return chunks


def chunk_by_sections(
    text: str,
    source_id: str,
    source_type: str,
    title: str,
    max_tokens: int = 500,
    overlap: int = 50,
) -> list[Chunk]:
    """Split text by headings first, then chunk each section."""
    # Split on markdown-style headings or numbered sections
    sections = re.split(r"\n(?=#{1,3}\s|(?:\d+\.?\s+[A-Z]))", text)

    all_chunks: list[Chunk] = []
    idx = 0

    for section in sections:
        section = section.strip()
        if not section or len(section) < 30:
            continue

        words = section.split()
        if len(words) <= max_tokens:
            all_chunks.append(Chunk(
                text=section,
                source_id=source_id,
                source_type=source_type,
                title=title,
                chunk_index=idx,
            ))
            idx += 1
        else:
            sub_chunks = chunk_text(
                section, source_id, source_type, title,
                max_tokens=max_tokens, overlap=overlap,
            )
            for sc in sub_chunks:
                sc.chunk_index = idx
                idx += 1
            all_chunks.extend(sub_chunks)

    return all_chunks
