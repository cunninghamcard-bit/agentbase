# Agentbase Backend — RAG Engine Design

> 面向 AI Agent 领域论文与博客的检索增强问答后端。
> 设计目标：**在 50 题黄金集上，Recall@10 ≥ 90%、引文准确率 ≥ 85%、p50 端到端延迟 < 3s**。

---

## 1. 北极星：Contextual Retrieval

参考 [Anthropic — Introducing Contextual Retrieval (2024-09)](https://www.anthropic.com/news/contextual-retrieval)：
在切块后用 LLM 给每个 chunk 补一段 **"这个chunk在整篇文档中的上下文"**（50–100 tokens），
再去做 embedding 和 BM25，可把"检索失败率"从 5.7% 降到 1.9%（-67%）。

本项目在此基础上做工程化：
- 用 **Anthropic Prompt Caching** 把文档全文缓存，contextual 生成 cost 降到 ~1/10。
- 与 **Hybrid Retrieval + Cross-Encoder Rerank** 串联，进一步把失败率压到 0.5% 级别。

---

## 2. 架构总览

```
                        ┌──────────────────────────────┐
           User Query ─►│  Query Understanding Layer    │
                        │  · multi-query expand (LLM)   │
                        │  · HyDE hypothetical doc      │
                        └───────────────┬──────────────┘
                                        │ {q, q1, q2, q3, hyde_doc}
                ┌───────────────────────┼────────────────────────┐
                ▼                       ▼                        ▼
        ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
        │ Dense Recall │        │ Sparse Recall│        │ ColBERT-Lite │
        │  BGE-M3      │        │  BM25 (bm25s)│        │ (optional)   │
        │  LanceDB HNSW│        │  in-proc     │        │ late interact│
        └──────┬───────┘        └──────┬───────┘        └──────┬───────┘
               └────────────┬──────────┴───────────────────────┘
                            ▼
                 ┌──────────────────────┐
                 │   RRF Fusion (k=60)  │  top-50 candidates
                 └──────────┬───────────┘
                            ▼
                 ┌──────────────────────┐
                 │ Cross-Encoder Rerank │  bge-reranker-v2-m3 (local, fp16)
                 │  top-50 → top-8      │
                 └──────────┬───────────┘
                            ▼
                 ┌──────────────────────┐
                 │ Parent-Doc Expansion │  小块命中→返回父段落
                 └──────────┬───────────┘
                            ▼
                 ┌──────────────────────┐
                 │ Answer Generation    │  Claude Sonnet + prompt cache
                 │ SSE streaming        │  structured citations
                 └──────────────────────┘

─── Offline Pipeline ──────────────────────────────────────────────
  arxiv (LaTeX via ar5iv) / blog (trafilatura)
   → Structure-aware Chunker (section boundary + semantic split)
      · child chunk: 256 tok   (for retrieval)
      · parent chunk: 1024 tok (for generation)
   → Contextual Augmentation (Claude Haiku + prompt cache)
   → BGE-M3 batch embed (dense + sparse in one pass)
   → LanceDB (HNSW, cosine) + bm25s index
   → content-hash dedup, incremental upsert
```

---

## 3. 模块细节 & OSS 参考

### 3.1 Ingestion

| 组件 | 选型 | 参考 |
|---|---|---|
| arxiv 获取 | ar5iv HTML（比 PDF 干净 10×） | [ar5iv.org](https://ar5iv.labs.arxiv.org) |
| 博客获取 | trafilatura 正文抽取 | [adbar/trafilatura](https://github.com/adbar/trafilatura) |
| 切分 | 先按 heading / section 切，再 semantic split | [RAGFlow 的 DeepDoc](https://github.com/infiniflow/ragflow)、[LangChain RecursiveCharacterTextSplitter] |
| Parent-Doc | 小块索引 + 父块上下文 | [LlamaIndex ParentDocumentRetriever](https://docs.llamaindex.ai) |
| Contextual Aug | Claude Haiku + 全文 prompt cache | Anthropic 官方博客 |
| 去重 | SHA256(text) + source_id 复合键 | — |

**切分策略**：
- Child: **256 tokens, overlap 32**（检索粒度，定位精准）
- Parent: **1024 tokens**（生成粒度，上下文完整）
- 存储时两者通过 `parent_id` 关联；检索命中 child，取 parent 送入 LLM。

### 3.2 Embedding

- **BGE-M3**（BAAI/bge-m3）：一次前向同时输出 **dense + sparse(lexical weight) + multi-vector**。
- 选它的原因：
  - 一个模型做两件事，省一次前向。
  - 1024 dim，多语言（中英混合语料友好）。
  - OSS：[FlagEmbedding](https://github.com/FlagOpen/FlagEmbedding)
- Query embed 用 `query_embed`，doc embed 用 `passage_embed`（BGE-M3 是非对称的）。

### 3.3 Hybrid Retrieval

| 路 | 实现 | 召回数 |
|---|---|---|
| Dense | LanceDB HNSW (M=16, efConstruction=200) + BGE-M3 dense | 50 |
| Sparse | [bm25s](https://github.com/xhluca/bm25s)（比 rank_bm25 快 ~100×）| 50 |
| (可选) ColBERT-Lite | BGE-M3 multi-vector + MaxSim | 30 |

### 3.4 Fusion — RRF

```python
def rrf(ranked_lists: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for lst in ranked_lists:
        for rank, doc_id in enumerate(lst):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])
```

参考：[Cormack et al. 2009, RRF 原论文](https://plg.uwaterloo.ca/~gvcormack/cormacksigir09-rrf.pdf)、Elasticsearch / Weaviate 官方实现。

### 3.5 Rerank

- **bge-reranker-v2-m3**（~568M, fp16 ~1.1GB），本地 CPU 也能跑（~50ms/query on 50 docs）。
- 输入 (query, passage) pair，输出相关性分数。
- 参考：[FlagEmbedding/Reranker](https://github.com/FlagOpen/FlagEmbedding/tree/master/FlagEmbedding/reranker)、Jina Reranker v2（API 备选）。

### 3.6 Query Understanding

两条并行：

1. **Multi-query expansion**：Claude Haiku 把原 query 改写成 3 条不同措辞 / 不同粒度的子查询。
2. **HyDE**（[Gao et al. 2022](https://arxiv.org/abs/2212.10496)）：LLM 先生成一段假设的答案，对这段假设答案做 embedding 去检索（缓解 query-doc 语言不对齐）。

所有路召回结果一起进 RRF。

### 3.7 Generation

- **Claude Sonnet 4.6** + **prompt cache**（system prompt + context 走 cache，只有 question 走 live token）。
- **Structured citations**：LLM 输出 `[1] [2]`，后处理正则回填为 `{source_id, title, url}`。
- **SSE streaming**：沿用现有前端协议 `data: {"data": {"answer": ...}}\n\n`。

### 3.8 Cache

两层：
1. **Query-level semantic cache**：新 query embed 后，与最近 1k 条历史 query 算余弦，>0.95 直接返回缓存答案。参考 [GPTCache](https://github.com/zilliztech/GPTCache)。
2. **LLM prompt cache**：Anthropic 原生支持，context 段打 `cache_control`。

---

## 4. Eval Harness

没有数字的 RAG 是玄学。本项目自建评测：

### 4.1 黄金集
- **50 题**，覆盖 AI Agent 5 类问题（概念定义 / 方法对比 / 时间线追溯 / 具体数字 / 跨文档综合）。
- 每题人工标注 **ground-truth chunk_ids**（用于检索指标）+ **reference answer**（用于生成指标）。

### 4.2 指标

| 层 | 指标 | 工具 |
|---|---|---|
| 检索 | Recall@5 / Recall@10 / MRR / NDCG@10 | 自实现 |
| 生成 | Citation-F1（引文是否命中 gt chunk） | 自实现 |
| 生成 | Faithfulness / Answer-Relevance | [RAGAS](https://github.com/explodinggradients/ragas) LLM-as-judge |
| 延迟 | p50 / p95 / p99（各阶段 span） | opentelemetry |

### 4.3 回归保护
- CI 跑黄金集（采样 10 题，节省成本）。
- 任何指标跌 >2pp 拒绝合入。

---

## 5. 可观测性

每次 query 写一条 trace（JSONL）：

```json
{
  "query": "...",
  "timings_ms": {"expand": 120, "dense": 40, "sparse": 8, "fuse": 2, "rerank": 55, "llm_ttft": 380, "llm_total": 1420},
  "retrieved": [{"id":"...","score":0.87,"source":"dense"}, ...],
  "reranked_top_k": ["...", "..."],
  "answer_len": 624,
  "cache_hit": {"query": false, "prompt": true}
}
```

用于事后归因：哪一步慢了、哪一步召回漏了。

---

## 6. 目录结构（落地）

```
backend/app/
├── ingest/
│   ├── arxiv.py          # ar5iv HTML fetcher
│   ├── blog.py           # trafilatura extractor
│   ├── chunker.py        # structure-aware + parent/child
│   └── contextual.py     # Anthropic contextual augmentation
├── rag/
│   ├── embedder.py       # BGE-M3 wrapper (dense + sparse)
│   ├── store.py          # LanceDB + bm25s facade
│   ├── retrieve.py       # hybrid + RRF
│   ├── rerank.py         # bge-reranker-v2-m3
│   ├── expand.py         # multi-query + HyDE
│   ├── cache.py          # semantic query cache
│   └── pipeline.py       # end-to-end orchestration
├── eval/
│   ├── golden.jsonl      # 50 题黄金集
│   ├── metrics.py        # recall/mrr/ndcg/citation-f1
│   ├── ragas_runner.py   # faithfulness / answer-relevance
│   └── run.py            # one-shot eval CLI
├── observability/
│   └── trace.py          # JSONL span writer
└── routers/
    ├── chat.py           # SSE endpoint
    └── ingest.py         # trigger ingestion
```

---

## 7. 实现优先级（给自己的 TODO）

| P | 模块 | 理由 |
|---|---|---|
| P0 | Hybrid Retrieval (BGE-M3 + bm25s + RRF) | 核心提升，一行简历 |
| P0 | Cross-Encoder Rerank | 提升最显著，面试必问 |
| P0 | Eval Harness + 黄金集 | 没数字=没故事 |
| P1 | Parent-Doc | 改善生成质量 |
| P1 | Contextual Augmentation | Anthropic 最新范式，signal 强 |
| P2 | HyDE + Multi-query | 召回兜底 |
| P2 | Semantic Query Cache | 工程细节 |
| P3 | ColBERT-Lite | 锦上添花 |

---

## 8. 简历可写 Bullet（每条都能追问）

1. **混合检索架构**：BGE-M3 稠密向量 + bm25s 稀疏检索并行召回，Reciprocal Rank Fusion (k=60) 合并，Recall@10 相比纯向量基线从 **XX% → YY%**。
2. **Contextual Retrieval 落地**：参考 Anthropic 范式，用 Claude Haiku + prompt cache 给每个 chunk 注入文档级上下文，检索失败率 **-ZZ%**；借助 prompt cache 成本降至朴素方案的 **~10%**。
3. **Cross-Encoder 精排**：本地部署 bge-reranker-v2-m3 (fp16)，top-50 → top-8，NDCG@10 **+AA pp**，单次 rerank 延迟 ~50ms。
4. **Parent-Document 检索**：256-token 子块用于精准定位，1024-token 父块送入 LLM，兼顾检索精度与生成连贯性。
5. **结构感知切分**：基于 ar5iv HTML 的 section 树切分，保留小节语义边界，较朴素固定窗切分在长论文上 Recall@5 **+BB pp**。
6. **Eval Harness 闭环**：自建 50 题黄金集，覆盖 5 类问题，全链路跟踪 Recall@k / MRR / NDCG / Citation-F1 / Faithfulness，CI 回归保护。
7. **双层缓存**：语义相似度 >0.95 的 query 命中内存缓存 + Anthropic prompt cache，重复 query p99 延迟 **-CC%**。
8. **可观测性**：每次 query 写 JSONL span（各阶段 timing + 召回来源 + 命中分布），便于事后归因与 A/B。

> 所有带 XX / YY / ZZ 的数字，在跑完 eval 后填真实值——**不跑数字等于在简历上撒谎**。
