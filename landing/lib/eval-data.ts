/**
 * Real eval metrics from backend/app/eval/run.py on a 20-question golden set
 * over 474 arXiv papers / 28 675 chunks. Do NOT invent numbers here — rerun
 * eval and replace the values instead. Raw report: data/eval_report.json.
 */

export type Metric = {
  key: string;
  label: string;
  value: string;
  baseline?: string;
  delta?: string;
  hint?: string;
};

export const heroMetrics: Metric[] = [
  { key: "hit",    label: "Hit@10",       value: "30.0%", baseline: "20.0%", delta: "+10pp" },
  { key: "ndcg",   label: "NDCG@10",      value: "0.102", baseline: "0.075", delta: "+0.027" },
  { key: "p50",    label: "p50 retrieve", value: "1.35s", hint: "query → top-8, pre-LLM" },
  { key: "rerank", label: "Rerank p50",   value: "1.31s", hint: "MiniLM-L6 · 50 docs · CPU" },
];

export const qualityMetrics = [
  { label: "Hit@5",        ours: 25.0,  base: 15.0,  unit: "%", delta: "+10pp" },
  { label: "Hit@10",       ours: 30.0,  base: 20.0,  unit: "%", delta: "+10pp" },
  { label: "Recall@5",     ours: 12.0,  base:  7.0,  unit: "%", delta: "+5pp" },
  { label: "Recall@10",    ours:  8.5,  base:  6.0,  unit: "%", delta: "+2.5pp" },
  { label: "MRR",          ours: 0.188, base: 0.161, unit: "",  delta: "+0.027" },
  { label: "NDCG@10",      ours: 0.102, base: 0.075, unit: "",  delta: "+0.027" },
];

// Ablation uses NDCG@10 — captures both presence and position of relevant docs.
// BM25's incremental contribution after rerank is statistically null on this
// 20-query set; flagged honestly in caption.
export const ablation = [
  { label: "Full (hybrid + rerank)",  ndcg: 0.102, tone: "primary" as const },
  { label: "− BM25 (dense + rerank)", ndcg: 0.102 },
  { label: "− Rerank (hybrid only)",  ndcg: 0.081 },
  { label: "Baseline (dense top-k)",  ndcg: 0.075, tone: "muted" as const },
];

export type PipelineStage = {
  id: string;
  name: string;
  short: string;
  timing: string;
  summary: string;
  oss: { name: string; url: string }[];
  snippet?: string;
};

export const pipeline: PipelineStage[] = [
  {
    id: "dense",
    name: "Dense Retrieval",
    short: "Dense",
    timing: "36ms",
    summary:
      "fastembed (bge-small-en-v1.5) 出 query 向量，LanceDB HNSW 查 top-20。ONNX 本地推理，无外部 API 依赖。",
    oss: [
      { name: "fastembed", url: "https://github.com/qdrant/fastembed" },
      { name: "LanceDB", url: "https://github.com/lancedb/lancedb" },
    ],
  },
  {
    id: "sparse",
    name: "Sparse Retrieval",
    short: "BM25",
    timing: "<1ms",
    summary:
      "bm25s 进程内 BM25 索引，scipy sparse 实现，28k chunks 上查询次毫秒。与稠密检索并行召回。",
    oss: [
      { name: "xhluca/bm25s", url: "https://github.com/xhluca/bm25s" },
    ],
  },
  {
    id: "rrf",
    name: "RRF Fusion",
    short: "RRF",
    timing: "<1ms",
    summary:
      "Reciprocal Rank Fusion (k=60)，只用排名不用分数，稠密/稀疏不同分布的分数可直接合并。合并后取 top-50 交给精排。",
    oss: [
      { name: "Cormack SIGIR 2009", url: "https://plg.uwaterloo.ca/~gvcormack/cormacksigir09-rrf.pdf" },
    ],
    snippet: `def rrf(lists, k=60):
    scores = {}
    for lst in lists:
        for rank, doc_id in enumerate(lst):
            scores[doc_id] = scores.get(doc_id, 0) + 1/(k+rank+1)
    return sorted(scores.items(), key=lambda x: -x[1])`,
  },
  {
    id: "rerank",
    name: "Cross-Encoder Rerank",
    short: "Rerank",
    timing: "1.31s",
    summary:
      "fastembed TextCrossEncoder 跑当前线上 reranker，把 (query, passage) pair 从 50 精排到 8。整个 pipeline 最大耗时环节；更强模型仍在离线实验，不写进线上叙事。",
    oss: [
      { name: "fastembed.rerank", url: "https://github.com/qdrant/fastembed" },
      { name: "BAAI/bge-reranker-v2-m3", url: "https://huggingface.co/BAAI/bge-reranker-v2-m3" },
    ],
  },
  {
    id: "trace",
    name: "Trace",
    short: "Trace",
    timing: "—",
    summary:
      "每次检索写一条 trace：各阶段 timings_ms + 召回来源 (dense/sparse/both) + 最终 top-k。/api/chat/debug 端点直接吐 JSON 供前端 Live Inspector 用。",
    oss: [],
  },
  {
    id: "llm",
    name: "Answer Generation",
    short: "LLM",
    timing: "ttft varies",
    summary:
      "Claude Sonnet SSE 流式输出，答案内嵌 [1][2] 引文，最终事件回填 references 数组。LLM 不可用时降级流式回显 retrieved context。",
    oss: [
      { name: "Anthropic SDK", url: "https://github.com/anthropics/anthropic-sdk-python" },
    ],
  },
];

export const recentTraces = [
  { time: "live",   query: "detecting safety violations across many agent traces",           latency: "1.4s", cache: "miss", cited: "3/8" },
  { time: "live",   query: "long-term memory design for LLM agents",                         latency: "1.3s", cache: "miss", cited: "2/8" },
  { time: "live",   query: "how agents use external tools via structured calls",             latency: "1.4s", cache: "miss", cited: "5/8" },
  { time: "live",   query: "benchmarking LLM agents",                                        latency: "1.3s", cache: "miss", cited: "3/8" },
  { time: "live",   query: "defending against indirect prompt injection in tool-augmented",  latency: "1.4s", cache: "miss", cited: "4/8" },
];

export const techStack = [
  { name: "FastAPI",              role: "async web framework" },
  { name: "LanceDB",              role: "vector store · HNSW" },
  { name: "fastembed",            role: "ONNX dense embed" },
  { name: "bm25s",                role: "sparse BM25 index" },
  { name: "TextCrossEncoder",     role: "MiniLM-L-6 rerank" },
  { name: "Claude Sonnet",        role: "generation · SSE" },
  { name: "Anthropic SDK",        role: "llm client" },
  { name: "Next.js 16 + React 19", role: "this UI" },
];
