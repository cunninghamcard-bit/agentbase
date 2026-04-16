"""PDF text extraction using PyMuPDF."""
from __future__ import annotations

from pathlib import Path

import pymupdf


def extract_text(pdf_path: Path) -> str:
    """Extract all text from a PDF file."""
    doc = pymupdf.open(str(pdf_path))
    pages = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages.append(text)
    doc.close()
    return "\n\n".join(pages)
