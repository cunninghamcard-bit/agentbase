import type { Metadata } from "next";
import Link from "next/link";
import { heroMetrics } from "@/lib/eval-data";
import { PipelineViz } from "@/components/pipeline-viz";
import { EvalDashboard } from "@/components/eval-dashboard";
import { TraceExplorer, TechStack } from "@/components/trace-explorer";

export const metadata: Metadata = {
  title: "Engine Room",
  description: "AgentBase 资料页。",
};

type PaperMeta = {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  primary_category: string;
  pdf_url: string;
};

const BACKEND_URL = "http://54.254.215.8:8000";

async function fetchPapers(): Promise<{ items: PaperMeta[]; total: number }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/papers?limit=8`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { items: [], total: 0 };
    return res.json();
  } catch {
    return { items: [], total: 0 };
  }
}

async function fetchBlogsTotal(): Promise<number> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/blogs?limit=1`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return 0;
    const body = (await res.json()) as { total?: number };
    return body.total ?? 0;
  } catch {
    return 0;
  }
}

export default async function EnginePage() {
  const [papersData, blogsTotal] = await Promise.all([fetchPapers(), fetchBlogsTotal()]);
  const papers = papersData.items;
  const papersTotal = papersData.total;
  const corpusAvailable = papersTotal > 0 || blogsTotal > 0;

  const hit = heroMetrics.find((m) => m.key === "hit")!;
  const ndcg = heroMetrics.find((m) => m.key === "ndcg")!;
  const p50 = heroMetrics.find((m) => m.key === "p50")!;
  const rerank = heroMetrics.find((m) => m.key === "rerank")!;

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="font-display text-[15px] italic text-foreground/85 transition hover:text-foreground"
          >
            AgentBase
          </Link>
          <div className="flex items-center gap-6 text-[12px]">
            <span className="hidden text-muted-foreground tnum sm:inline">
              {papersTotal} papers · {blogsTotal} blogs
            </span>
            <Link
              href="/"
              className="smcp text-muted-foreground transition hover:text-foreground"
            >
              目录
            </Link>
            <a
              href="#pipeline"
              className="smcp text-muted-foreground transition hover:text-foreground"
            >
              管线
            </a>
            <a
              href="#eval"
              className="smcp text-muted-foreground transition hover:text-foreground"
            >
              评测
            </a>
            <a
              href="#corpus"
              className="smcp text-muted-foreground transition hover:text-foreground"
            >
              语料
            </a>
            <Link
              href="/chat"
              className="text-foreground underline decoration-primary decoration-2 underline-offset-4 transition hover:text-primary"
            >
              对话
            </Link>
          </div>
        </div>
      </nav>

      {/* Engine header */}
      <section className="border-b border-border/40">
        <div className="mx-auto grid max-w-6xl grid-cols-12 gap-x-8 gap-y-10 px-6 pb-14 pt-16">
          <div className="caption col-span-12 flex items-center gap-3">
            <span className="dot-sm" />
            <span className="smcp text-[10.5px]">
              engine room · retrieval pipeline · numbers
            </span>
          </div>

          <div className="col-span-12 md:col-span-8">
            <h1 className="font-display text-[clamp(2.25rem,5.5vw,4rem)] font-medium leading-[1.04] tracking-tight text-foreground/95">
              封面背后的 <span className="italic text-primary">机器房</span>。
            </h1>
            <p className="lede mt-6 max-w-[62ch]">
              Issue 上那些提问之所以值得点进去，是因为后面这套东西不是套壳。
              混合检索 + cross-encoder 精排，把 &ldquo;对的那篇论文&rdquo; 命中到 top-10 的概率从{" "}
              <span className="metric-inline">{hit.baseline}</span> 提升到{" "}
              <span className="metric-inline">{hit.value}</span>（Hit@10，{hit.delta}）。
              NDCG@10 从 <span className="metric-inline">{ndcg.baseline}</span> 到{" "}
              <span className="metric-inline">{ndcg.value}</span>，端到端 p50{" "}
              <span className="metric-inline">{p50.value}</span>，其中 rerank 占{" "}
              <span className="metric-inline">{rerank.value}</span>。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <Link
                href="/"
                className="text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
              >
                ← 回到 Issue 01
              </Link>
              <Link
                href="/chat"
                className="text-foreground underline decoration-primary decoration-[2px] underline-offset-[6px] transition-all hover:decoration-[3px]"
              >
                直接去对话 →
              </Link>
            </div>
          </div>

          <aside className="col-span-12 md:col-span-4 md:border-l md:border-foreground/15 md:pl-6">
            <div className="mb-3 smcp text-[10px] text-muted-foreground">
              quality · measured
            </div>
            <dl className="space-y-3">
              {heroMetrics.map((m) => (
                <div key={m.key} className="flex items-baseline gap-3">
                  <dt className="flex-1 font-sans text-[12.5px] text-muted-foreground">
                    {m.label}
                  </dt>
                  <span
                    aria-hidden
                    className="flex-1 translate-y-[-3px] border-b border-dotted border-foreground/25"
                  />
                  <dd className="font-display text-lg text-foreground lnum tnum">
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="caption mt-5 italic">
              Measured on a 20-question golden set across retrieval-heavy AI Agent queries.
              Baseline: dense top-k only.
            </p>
            {!corpusAvailable && (
              <p className="caption mt-4 max-w-[28ch] leading-relaxed">
                Corpus offline. Set <span className="font-mono text-[11px]">BACKEND_URL</span> to
                the FastAPI service before launch.
              </p>
            )}
          </aside>
        </div>
      </section>

      <PipelineViz />
      <EvalDashboard />

      {corpusAvailable && (
        <section id="corpus" className="border-t border-border/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-10 grid grid-cols-12 items-baseline gap-6">
              <div className="col-span-12 md:col-span-8">
                <div className="caption">
                  <span className="fig-label">§ 4.</span>
                  corpus · incremental ingestion · content-hash dedup
                </div>
                <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-foreground/90 md:text-4xl">
                  语料库
                </h2>
              </div>
              <div className="col-span-12 text-sm leading-relaxed text-muted-foreground md:col-span-4">
                <span className="metric-inline">{papersTotal}</span> 篇 arXiv 论文 ·
                <span className="metric-inline ml-1">{blogsTotal}</span> 篇前沿技术博客。
                arxiv 走 ar5iv HTML、blog 走 trafilatura，比 PDF 文本提取干净一个数量级。
              </div>
            </div>

            <h3 className="mb-4 smcp text-[10px] text-muted-foreground">selected papers</h3>
            <ol className="list-none border-t border-foreground/15">
              {papers.map((p) => (
                <li
                  key={p.arxiv_id}
                  className="grid grid-cols-12 items-baseline gap-4 border-b border-foreground/10 py-4"
                >
                  <span className="col-span-2 font-mono text-[10.5px] text-muted-foreground tnum md:col-span-1">
                    {p.published.slice(0, 7)}
                  </span>
                  <a
                    href={p.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group col-span-10 md:col-span-8"
                  >
                    <h4 className="text-[15px] leading-snug text-foreground transition group-hover:text-primary">
                      {p.title}
                    </h4>
                    <p className="mt-0.5 font-display text-[12px] italic text-muted-foreground">
                      {p.authors.slice(0, 3).join(", ")}
                      {p.authors.length > 3 ? " et al." : ""}
                    </p>
                  </a>
                  <span className="col-span-12 font-mono text-[10.5px] text-muted-foreground/80 tnum md:col-span-3 md:text-right">
                    arXiv:{p.arxiv_id}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <TraceExplorer />
      <TechStack />

      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between px-6 py-6">
          <p className="caption">
            <span className="fig-label">AgentBase / engine.</span>
            FastAPI · LanceDB · bge-small-en-v1.5 · bm25s · Claude Sonnet · Next.js ·{" "}
            {new Date().getFullYear()}
          </p>
          <p className="smcp text-[10px] text-muted-foreground">fin.</p>
        </div>
      </footer>
    </div>
  );
}
