from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Paths (relative to agentbase root)
    project_root: Path = Path(__file__).resolve().parent.parent.parent
    data_dir: Path = Path("")
    papers_dir: Path = Path("")
    blogs_dir: Path = Path("")
    db_path: Path = Path("")

    # LLM
    llm_api_key: str = ""
    llm_api_base: str = "https://api.anthropic.com"
    llm_model: str = "claude-sonnet-4-20250514"
    llm_provider: str = "anthropic"  # "anthropic" or "openai"

    # Embedding
    embed_model: str = "BAAI/bge-small-en-v1.5"

    # RAG
    chunk_size: int = 500
    chunk_overlap: int = 50
    retrieval_top_k: int = 20
    rerank_top_k: int = 5

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def model_post_init(self, __context: object) -> None:
        if not self.data_dir.is_absolute():
            self.data_dir = self.project_root / "data"
        if not self.papers_dir.is_absolute():
            self.papers_dir = self.project_root / "papers"
        if not self.blogs_dir.is_absolute():
            self.blogs_dir = self.project_root / "blogs"
        if not self.db_path.is_absolute():
            self.db_path = self.data_dir / "lancedb"


settings = Settings()
