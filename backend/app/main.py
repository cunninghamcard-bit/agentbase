from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # Startup: ensure directories exist
    settings.db_path.mkdir(parents=True, exist_ok=True)
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="AgentBase API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "papers_dir": str(settings.papers_dir),
        "blogs_dir": str(settings.blogs_dir),
        "db_path": str(settings.db_path),
    }


# Import routers after app is created to avoid circular imports
from app.routers import papers, blogs, chat, ingest  # noqa: E402

app.include_router(papers.router, prefix="/api")
app.include_router(blogs.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(ingest.router, prefix="/api")
