import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_project_root = Path(__file__).resolve().parent.parent.parent
_root_env_file = _project_root / ".env"
_backend_env_file = _project_root / "backend" / ".env"

# Pin fastembed cache to project-local directory so models survive /tmp cleanup
_cache_root = _project_root / "models" / "fastembed-cache"
os.environ.setdefault("FASTEMBED_CACHE_PATH", str(_cache_root))


class Settings(BaseSettings):
    # Paths (relative to agentbase root)
    project_root: Path = _project_root
    data_dir: Path = Path("")
    papers_dir: Path = Path("")
    blogs_dir: Path = Path("")
    db_path: Path = Path("")
    bm25_path: Path = Path("")

    # LLM
    llm_api_key: str = ""
    openai_api_key: str = ""      # auto-mapped from OPENAI_API_KEY env/.env
    anthropic_api_key: str = ""   # auto-mapped from ANTHROPIC_API_KEY env/.env
    llm_api_base: str = "https://api.kimi.com/coding/"
    llm_model: str = "kimi-latest"
    llm_provider: str = "anthropic"  # "anthropic" or "openai"

    # CORS
    cors_origins: str = "*"

    # Embedding — kept at bge-small; upgrading to bge-base requires re-embedding 28k chunks (~100min CPU).
    embed_model: str = "BAAI/bge-small-en-v1.5"
    # Cross-encoder reranker — bge-reranker-base (278M) is the biggest lever here.
    rerank_model: str = "BAAI/bge-reranker-base"
    # Feature toggles
    use_hybrid: bool = True   # dense + bm25 + RRF
    use_rerank: bool = True   # cross-encoder rerank

    # RAG
    chunk_size: int = 500
    chunk_overlap: int = 50
    retrieval_top_k: int = 20       # per retriever (dense / sparse)
    rerank_candidates: int = 50     # after RRF, before rerank
    rerank_top_k: int = 8           # after rerank, fed to LLM
    rrf_k: int = 60                 # RRF smoothing constant

    # LangGraph
    checkpoint_db: str = "data/langgraph.db"  # SQLite checkpoint store
    quality_threshold: float = 0.65  # min avg rerank score to pass evaluate_quality
    max_retrieve_retries: int = 2    # max query expansion loops
    auto_generate: bool = True       # skip human review if True

    model_config = SettingsConfigDict(
        env_file=(_root_env_file, _backend_env_file),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def model_post_init(self, __context: object) -> None:
        if not self.llm_api_key:
            self.llm_api_key = (
                os.getenv("LLM_API_KEY")
                or self.anthropic_api_key
                or self.openai_api_key
                or ""
            )
        if not self.data_dir.is_absolute():
            self.data_dir = self.project_root / "data"
        if not self.papers_dir.is_absolute():
            self.papers_dir = self.project_root / "papers"
        if not self.blogs_dir.is_absolute():
            self.blogs_dir = self.project_root / "blogs"
        if not self.db_path.is_absolute():
            self.db_path = self.data_dir / "lancedb"
        # BM25 index sidecar (stored alongside LanceDB)
        self.bm25_path = self.data_dir / "bm25"

    @property
    def llm_client_kwargs(self) -> dict[str, str]:
        kwargs: dict[str, str] = {}
        if self.llm_api_key:
            kwargs["api_key"] = self.llm_api_key
        if self.llm_api_base:
            kwargs["base_url"] = self.llm_api_base
        return kwargs


settings = Settings()
