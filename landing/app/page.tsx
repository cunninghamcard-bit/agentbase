import Link from "next/link";
import { SearchChat } from "@/components/search-chat";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

type PaperMeta = {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  primary_category: string;
  pdf_url: string;
};

type BlogMeta = {
  title: string;
  link: string;
  source: string;
  published?: string;
};

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

async function fetchBlogs(): Promise<{ items: BlogMeta[]; total: number }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/blogs?limit=6`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { items: [], total: 0 };
    return res.json();
  } catch {
    return { items: [], total: 0 };
  }
}

export default async function Home() {
  const [papersData, blogsData] = await Promise.all([
    fetchPapers(),
    fetchBlogs(),
  ]);

  const papers = papersData.items;
  const blogs = blogsData.items;
  const papersTotal = papersData.total;
  const blogsTotal = blogsData.total;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-foreground/80 hover:text-foreground transition">
            AgentBase
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <span className="hidden sm:inline text-muted-foreground font-mono">
              {papersTotal} 篇论文 · {blogsTotal} 篇博客
            </span>
            <a
              href="#corpus"
              className="text-muted-foreground hover:text-foreground transition"
            >
              语料库
            </a>
            <a
              href="#architecture"
              className="text-muted-foreground hover:text-foreground transition"
            >
              架构
            </a>
            <a
              href="https://github.com/2725244134"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border/50 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-border transition"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Chat + Trending (handled by SearchChat in empty state) */}
      <SearchChat papersCount={papersTotal} blogsCount={blogsTotal} />

      {/* Stats bar */}
      <section className="border-t border-border/30 bg-primary/5">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: papersTotal.toString(), label: "arXiv 论文" },
              { value: blogsTotal.toString(), label: "技术博客" },
              { value: "8+", label: "研究主题" },
              { value: "RAG", label: "智能检索" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-semibold text-primary">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corpus */}
      <section id="corpus" className="border-t border-border/30 bg-card/20">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold">语料库</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {papersTotal} 篇 arXiv 论文和 {blogsTotal} 篇前沿技术博客，持续更新中。
              </p>
            </div>
            <div className="hidden sm:flex gap-4 text-xs font-mono text-muted-foreground">
              <span>cs.AI</span>
              <span>cs.CL</span>
              <span>cs.CR</span>
            </div>
          </div>

          {/* Papers */}
          <div className="mt-8">
            <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
              最近论文
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {papers.map((p) => (
                <a
                  key={p.arxiv_id}
                  href={p.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-lg border border-border/30 bg-background/60 p-4 transition hover:border-border/60 hover:bg-card/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-medium leading-snug group-hover:text-foreground transition line-clamp-2">
                      {p.title}
                    </h4>
                    <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {p.arxiv_id}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {p.abstract}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                    <span>{p.authors.slice(0, 3).join(", ")}{p.authors.length > 3 ? " et al." : ""}</span>
                    <span>·</span>
                    <span>{p.published.slice(0, 10)}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Blogs */}
          <div className="mt-12">
            <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
              前沿博客
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {blogs.map((b, i) => (
                <a
                  key={i}
                  href={b.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-lg border border-border/30 bg-background/60 p-4 transition hover:border-border/60 hover:bg-card/40"
                >
                  <span className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {b.source}
                  </span>
                  <h4 className="mt-2 text-sm font-medium leading-snug group-hover:text-foreground transition line-clamp-2">
                    {b.title}
                  </h4>
                  {b.published && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                      {b.published.slice(0, 16)}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="border-t border-border/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-lg font-semibold">架构</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            端到端 RAG 管线：自动化数据采集、深度 PDF 解析、混合检索与溯源生成。
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "数据采集",
                desc: "通过 arXiv API 和 Jina Reader 定期抓取论文与博客，元数据存储为 JSONL，PDF 本地归档。",
                tech: "Python · arXiv · Jina",
              },
              {
                label: "解析 & 切片",
                desc: "PyMuPDF 处理公式、表格和多栏布局。论文按章节感知切片，博客按段落级别切片。",
                tech: "PyMuPDF · FastAPI",
              },
              {
                label: "检索",
                desc: "fastembed 本地向量化 + LanceDB 向量检索，基于相关性评分重排序，确保精准召回。",
                tech: "fastembed · LanceDB",
              },
              {
                label: "生成",
                desc: "基于检索上下文的溯源回答，附带来源引用。SSE 流式传输，每个论断可追溯到原始段落。",
                tech: "Anthropic · SSE · Next.js",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border/30 bg-card/20 p-4">
                <h3 className="text-sm font-medium">{item.label}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
                <p className="mt-3 font-mono text-[10px] text-muted-foreground/60">
                  {item.tech}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          AgentBase · FastAPI + LanceDB + Next.js · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
