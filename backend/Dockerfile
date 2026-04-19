FROM python:3.12-slim

WORKDIR /app

# System deps for PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev && \
    rm -rf /var/lib/apt/lists/*

# Use pip with Chinese mirror for faster install
COPY pyproject.toml .
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "pydantic-settings>=2.0" \
    "lancedb>=0.20" "fastembed>=0.6" "bm25s>=0.2" "pymupdf>=1.25" \
    "anthropic>=0.52" "openai>=1.0"

COPY app/ app/

# Pre-download embedding model at build time
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
