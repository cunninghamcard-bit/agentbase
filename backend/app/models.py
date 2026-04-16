from __future__ import annotations
from pydantic import BaseModel


# --- Request models ---

class ChatRequest(BaseModel):
    question: str


class IngestRequest(BaseModel):
    source: str = "all"  # "papers", "blogs", "all"


# --- Response models ---

class PaperItem(BaseModel):
    arxiv_id: str
    title: str
    authors: list[str]
    abstract: str
    published: str
    primary_category: str
    pdf_url: str

class PaperList(BaseModel):
    items: list[PaperItem]
    total: int
    page: int
    limit: int


class BlogItem(BaseModel):
    uid: str
    source: str
    title: str
    link: str
    published: str

class BlogList(BaseModel):
    items: list[BlogItem]
    total: int
    page: int
    limit: int


class StatsResponse(BaseModel):
    papers: int
    blogs: int
    chunks: int
    indexed: bool


class IngestResponse(BaseModel):
    status: str
    papers_chunked: int = 0
    blogs_chunked: int = 0
    total_chunks: int = 0
