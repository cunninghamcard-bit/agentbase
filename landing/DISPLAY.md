# Agentbase Landing — Display Design

> 目标：让面试官在 **30 秒内**看出这不是套壳 RAG。
> 策略：把后端 `DESIGN.md` 里的每个算法点，**可视化 + 可交互 + 带数字**地摆出来。

---

## 设计原则

遵循 `CLAUDE.md`：暖奶油底、赤陶橙强调、light mode、中文文案 / 英文术语。
额外三条：

1. **数字优先**：所有展示必须有真实数字，不写"高性能""先进"这种空话。
2. **可点击即可看细节**：每个模块可展开看 OSS 依赖、代码片段、trace 样本。
3. **流动感**：用动画把 query 在 pipeline 里的流动画出来，而不是静态架构图。

---

## 页面结构

```
Nav
├─ Hero            ← 数字驱动，替换空洞的 "8+ topics"
├─ Pipeline Viz    ★ 核心展示：交互式流水线
├─ Live Query      ★ 核心展示：实时拆解一条真实 query
├─ Eval Dashboard  ★ 核心展示：数字、ablation
├─ Architecture    ← 可交互架构图（替换现有4卡片）
├─ Trace Explorer  ← 最近 query 的 JSONL trace 表
├─ Tech Stack      ← OSS 依赖清单
└─ Footer
```

---

## ① Hero（小改）

**现状**：`从 N+ 篇论文中 / 找到答案`，下面 4 个 stat（论文数/博客数/8+主题/RAG）。

**改为**：同样的标题，stat bar 换成**真实 eval 数字**：

```
┌─────────┬─────────┬──────────┬─────────────┐
│  92.4%  │  0.87   │  1.4s    │  48ms       │
│Recall@10│Cite-F1  │p50 端到端│Rerank 延迟  │
└─────────┴─────────┴──────────┴─────────────┘
                vs. naive RAG baseline
          Recall@10 +31pp · 失败率 -67%
```

每个数字下面小字标 baseline 对比。**没数字面试官不信**，这一行就是第一印象。

---

## ② Pipeline Visualizer ★

一张水平流水线图，query 像气泡一样从左流到右，**每个阶段高亮并显示 timing**。

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   [Query]──►[Expand]──►[Hybrid]──►[RRF]──►[Rerank]──►[Parent]──►[LLM]│
│              120ms     dense 40ms  2ms    55ms       1ms     ttft 380│
│                        sparse 8ms                                    │
│                                                                      │
│   ━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   （当前动画小球位置）                                                │
└──────────────────────────────────────────────────────────────────────┘
```

**交互**：
- 点任一节点 → 右侧抽屉展开：
  - 一句话说明「这步在做什么」
  - 所用 OSS（可跳转）：BGE-M3 / bm25s / bge-reranker-v2-m3 / ...
  - 代码片段（RRF 20 行、rerank 调用 15 行等）
  - 这一步在最近 100 条 query 上的 p50/p95 延迟
- 顶部切换 tab：「默认管线」「朴素 RAG 对照」「ablation 模式」

**实现**：静态 SVG + Framer Motion 的 `animate` 做小球流动，不需要真后端推流。

---

## ③ Live Query Inspector ★

面试官最想看的：**输一个问题，把整个 RAG 的内部过程拆给我看**。

```
┌──────────────────────────────────────────────────────────────────────┐
│ 问题：What is the key idea behind ReAct?                     [提交]  │
└──────────────────────────────────────────────────────────────────────┘

┌─── Query Understanding ──────────────────────────────────────────────┐
│ Original: What is the key idea behind ReAct?                         │
│ Expand 1: How does ReAct combine reasoning and acting?               │
│ Expand 2: ReAct prompting method explanation                         │
│ HyDE:     ReAct is a prompting paradigm that interleaves reasoning   │
│           traces with action steps, enabling LLMs to ...             │
└──────────────────────────────────────────────────────────────────────┘

┌─── Hybrid Retrieval (top-10 each) ───────────────────────────────────┐
│ │ Dense (BGE-M3)                  │ Sparse (BM25)                 │  │
│ │───────────────────────────────  │───────────────────────────────│  │
│ │ ★ 2210.03629 §2.1    0.89  ●RRF │ ★ 2210.03629 §2.1   18.3 ●RRF │  │
│ │ ★ 2210.03629 §3.2    0.84  ●RRF │   2305.16291 §1     14.1      │  │
│ │   2305.16291 §1      0.78       │ ★ 2210.03629 §3.2   12.7 ●RRF │  │
│ │   ...                           │ ...                           │  │
└──────────────────────────────────────────────────────────────────────┘
   ● = 进入 RRF top-50     ★ = 被 Rerank 选入 top-8

┌─── Cross-Encoder Rerank (top-8) ─────────────────────────────────────┐
│ 1. 2210.03629 §2.1    score 0.94  ← Dense + Sparse 双路命中          │
│ 2. 2210.03629 §3.2    score 0.91                                     │
│ 3. 2305.16291 §1      score 0.73                                     │
│ ...                                                                  │
└──────────────────────────────────────────────────────────────────────┘

┌─── Answer (streaming) ───────────────────────────────────────────────┐
│ ReAct [1] is a prompting paradigm that interleaves reasoning         │
│ traces with task-specific actions [2], allowing LLMs to ...          │
│                                                                      │
│ 引文：[1] ReAct: Synergizing Reasoning and Acting — §2.1             │
│       [2] ReAct: Synergizing Reasoning and Acting — §3.2             │
└──────────────────────────────────────────────────────────────────────┘
```

**交互**：
- 点引文 `[1]` → 滚动高亮对应 retrieved chunk
- hover chunk → 显示 BM25 score、dense score、rerank score 三列对比
- 顶部按钮「换一题」→ 预置 6 个代表性问题（不需要用户打字）

**实现**：
- 后端需要新增一个 `/api/chat/debug` 端点，返回带完整中间状态的 JSON（而不只是答案）。
- 前端用 Server-Sent Events 流 + 一个 `reducer` 按阶段更新 UI。

---

## ④ Eval Dashboard ★

```
┌────────────── RAG Quality Metrics (50-question golden set) ──────────────┐
│                                                                          │
│            Agentbase        Naive RAG        Δ                           │
│  Recall@5     84.0%            56.0%        +28pp  ██████░░              │
│  Recall@10    92.4%            61.2%        +31pp  ███████░              │
│  MRR          0.71             0.43         +0.28  ███████░              │
│  NDCG@10      0.79             0.48         +0.31  ███████░              │
│  Citation-F1  0.87             0.58         +0.29  ███████░              │
│  Faithfulness 0.93             0.79         +0.14  ████░░░░              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌────────────── Ablation — 去掉某组件后 Recall@10 ──────────────┐
│                                                                │
│  Full pipeline          ████████████████████████████  92.4%    │
│  − Contextual Aug       ██████████████████████░░░░░░  85.1%    │
│  − Cross-Encoder        █████████████████░░░░░░░░░░░  78.8%    │
│  − BM25 (dense only)    ████████████████░░░░░░░░░░░░  74.2%    │
│  − HyDE                 ██████████████████████████░░  89.6%    │
│  Naive (dense top-k)    █████████████░░░░░░░░░░░░░░░  61.2%    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**为什么有这个**：Ablation 图是**研究型面试的核心信号**——表明你不仅堆模块，还量化过每个模块的贡献。

**实现**：一次性生成的静态图表（eval 跑完后写入 JSON，前端读）。

---

## ⑤ Architecture Diagram（替换现有卡片）

用一张真正的 SVG 架构图替换现有 4 卡片。每个方块 hover 高亮、点击弹出：

```
                     ┌───────────────────┐
     User Query ────►│ Query Understanding│──┐
                     └───────────────────┘   │ {q, q1, q2, q3, hyde}
                                             ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │ Dense Recall │  │ Sparse Recall│  │ ColBERT-Lite │
            │  BGE-M3      │  │  bm25s       │  │  (optional)  │
            │  LanceDB HNSW│  │              │  │              │
            └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                   └────────────┬────┴─────────────────┘
                                ▼
                    ┌──────────────────────┐
                    │   RRF Fusion (k=60)  │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ bge-reranker-v2-m3   │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ Parent-Doc Expansion │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ Claude + Prompt Cache│──► SSE stream
                    └──────────────────────┘
```

弹窗内容示例（点击 "bge-reranker-v2-m3"）：

```
Cross-Encoder Rerank
─────────────────────────────────
模型：BAAI/bge-reranker-v2-m3
大小：568M params, fp16 ~1.1GB
部署：本地 ONNX Runtime, CPU fp16
输入：(query, passage) pair
输出：relevance score ∈ [0, 1]
延迟：~48ms / 50 docs (p50)
增益：NDCG@10 +0.14 vs no rerank
```

---

## ⑥ Trace Explorer

最近 N 条 query 的 JSONL trace 可视化：

```
┌── Recent Queries ───────────────────────────────────────────────────┐
│ Time      Query                    Latency  Cache  Recall           │
│ 15:32:01  What is ReAct?           1.3s     miss   ✓ 3/3 cited      │
│ 15:31:45  Tool use in Claude 3.7   1.8s     hit    ✓ 4/5 cited      │
│ 15:30:22  Agent memory systems     2.1s     miss   ✓ 5/5 cited      │
│ ...                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

点击任一行展开：timing breakdown 柱状图 + 召回来源饼图 + 命中 chunk 列表。

**动机**：让面试官感受"这个系统是带可观测性的产品，不是 demo"。

---

## ⑦ Tech Stack

横向 logo bar：FastAPI · LanceDB · BGE-M3 · bm25s · bge-reranker-v2-m3 · Anthropic · RAGAS · Next.js。
每个 logo 下面一行小字标版本和用途。

---

## 路由规划

| 路径 | 用途 |
|---|---|
| `/` | Hero + Pipeline Viz + Eval + Arch + Trace（面试官入口） |
| `/chat` | 纯对话界面（给真实用户用） |
| `/inspect` | Live Query Inspector 全屏版（面试现场 demo 用） |
| `/eval` | Eval Dashboard 详情页（可下载黄金集 JSON） |

---

## 实现优先级

| P | 组件 | 价值 | 实现难度 |
|---|---|---|---|
| P0 | Hero 数字替换 | 第一印象 | 低 |
| P0 | Eval Dashboard | 量化信号最硬 | 中（需先跑 eval） |
| P0 | Live Query Inspector | 面试现场杀招 | 高（要改后端） |
| P1 | Pipeline Visualizer | 动画，加分项 | 中 |
| P1 | Architecture Diagram | 静态展示 | 低 |
| P2 | Trace Explorer | 工程感 | 中 |
| P3 | /inspect 全屏版 | 现场 demo | 低 |

---

## 一句话总结

> 面试官 30 秒滚完首页，应该得到这样的印象：
> **"这人不只会调 `openai.chat.completions.create`，他懂检索、懂评测、懂可观测性。"**
