import type { Metadata } from "next";
import Link from "next/link";
import { issues, issueMeta } from "@/lib/issues";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export const metadata: Metadata = {
  title: "Open Agent Questions",
  description:
    "面向 AI/ML 面试官与研究者的 Agent 问题目录。首页更轻，细节收进 /engine。",
};

const issueAtlas = [
  {
    id: "trust",
    label: "boundaries",
    chineseLabel: "边界",
    issueIds: ["safety", "tools", "self"],
  },
  {
    id: "memory",
    label: "memory",
    chineseLabel: "记忆",
    issueIds: ["memory", "planning", "world"],
  },
  {
    id: "systems",
    label: "systems",
    chineseLabel: "协作",
    issueIds: ["multi-agent", "eval"],
  },
] as const;

async function fetchCorpusTotals(): Promise<{ papers: number; blogs: number }> {
  const safeJson = async (url: string) => {
    try {
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) return 0;
      const body = (await res.json()) as { total?: number };
      return body.total ?? 0;
    } catch {
      return 0;
    }
  };

  const [papers, blogs] = await Promise.all([
    safeJson(`${BACKEND_URL}/api/papers?limit=1`),
    safeJson(`${BACKEND_URL}/api/blogs?limit=1`),
  ]);
  return { papers, blogs };
}

function chatHref(question: string) {
  return `/chat?q=${encodeURIComponent(question)}`;
}

export default async function Home() {
  const { papers, blogs } = await fetchCorpusTotals();
  const lead = issues[0];
  const rest = issues.slice(1);
  const atlas = issueAtlas.map((group) => ({
    ...group,
    entries: group.issueIds
      .map((id) => issues.find((issue) => issue.id === id))
      .filter((issue): issue is (typeof issues)[number] => Boolean(issue)),
  }));
  const today = new Date();
  const dateLine = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

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
              {papers} papers · {blogs} blogs
            </span>
            <a
              href="#issues"
              className="smcp text-muted-foreground transition hover:text-foreground"
            >
              目录
            </a>
            <Link
              href="/engine"
              className="smcp text-muted-foreground transition hover:text-foreground"
            >
              资料
            </Link>
            <Link
              href="/chat"
              className="text-foreground underline decoration-primary decoration-2 underline-offset-4 transition hover:text-primary"
            >
              对话
            </Link>
          </div>
        </div>
      </nav>

      {/* Masthead — gazette, not dashboard */}
      <header className="border-b-2 border-foreground/70">
        <div className="mx-auto grid max-w-6xl grid-cols-12 items-end gap-x-8 gap-y-6 px-6 pb-8 pt-16">
          <div className="col-span-12 flex items-center justify-between">
            <span className="smcp text-[10.5px] text-muted-foreground">
              {issueMeta.volume} · {issueMeta.number} · {issueMeta.season}
            </span>
            <span className="font-mono text-[10.5px] text-muted-foreground tnum">
              {dateLine}
            </span>
          </div>

          <div className="col-span-12">
            <h1 className="font-display text-[clamp(3rem,9vw,7rem)] font-medium leading-[0.92] tracking-tight text-foreground/95">
              <span className="italic">Open</span> Agent Questions
            </h1>
          </div>

          <div className="col-span-12 flex flex-wrap items-baseline justify-between gap-4">
            <p className="max-w-[56ch] font-display text-base italic leading-relaxed text-foreground/80">
              {issueMeta.tagline}
            </p>
            <span className="smcp text-[10px] text-muted-foreground">
              questions · notes · archive
            </span>
          </div>
        </div>
      </header>

      {/* Lead — one issue pulled forward */}
      <section className="border-b border-border/40 bg-[oklch(0.955_0.015_80)]">
        <div className="mx-auto grid max-w-6xl grid-cols-12 gap-x-8 gap-y-6 px-6 py-16">
          <div className="col-span-12 md:col-span-3">
            <div className="caption">
              <span className="fig-label">卷首.</span>
              {lead.field}
            </div>
            <p className="mt-2 font-display text-[4rem] font-medium italic leading-none text-primary lnum">
              {lead.ordinal}
            </p>
            <p className="mt-3 smcp text-[10px] text-muted-foreground">
              {lead.chineseField} · open problem
            </p>
          </div>

          <div className="col-span-12 md:col-span-9">
            <h2 className="max-w-[22ch] font-display text-[clamp(1.875rem,3.6vw,3rem)] font-medium leading-[1.1] tracking-tight text-foreground">
              {lead.title}
            </h2>
            <p className="mt-6 max-w-[56ch] font-display text-[1.05rem] italic leading-relaxed text-foreground/76">
              {lead.question}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
              <Link
                href={chatHref(lead.question)}
                className="text-foreground underline decoration-primary decoration-[2px] underline-offset-[6px] transition-all hover:decoration-[3px]"
              >
                对话
              </Link>
              <a
                href="#issues"
                className="text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
              >
                目录
              </a>
              <Link
                href="/engine"
                className="text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
              >
                资料
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/40 bg-[oklch(0.972_0.012_84)]">
        <div className="mx-auto grid max-w-6xl grid-cols-12 gap-x-8 gap-y-10 px-6 py-16">
          <div className="col-span-12 md:col-span-4">
            <div className="caption">
              <span className="fig-label">分栏.</span>
              sections
            </div>
            <h3 className="mt-2 max-w-[11ch] font-display text-[clamp(2rem,4vw,3.3rem)] font-medium leading-[1.05] tracking-tight text-foreground/92">
              三组问题。
            </h3>
            <p className="mt-5 max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
              首页放目录。细节在 <Link href="/engine" className="underline decoration-primary/55 underline-offset-3 transition hover:text-foreground">/engine</Link>。
            </p>
          </div>

          <div className="col-span-12 grid gap-8 md:col-span-8 md:grid-cols-3">
            {atlas.map((group) => (
              <article key={group.id} className="border-t border-foreground/15 pt-4">
                <p className="smcp text-[10px] text-muted-foreground">{group.label}</p>
                <h4 className="mt-2 font-display text-[1.85rem] font-medium italic leading-none text-primary/90">
                  {group.chineseLabel}
                </h4>
                <ul className="mt-5 space-y-3">
                  {group.entries.map((entry) => (
                    <li key={entry.id}>
                      <Link
                        href={chatHref(entry.question)}
                        className="group flex items-start gap-3 text-sm leading-relaxed"
                      >
                        <span className="font-display text-[1.05rem] italic text-primary/80 lnum">
                          {entry.ordinal}
                        </span>
                        <span className="text-foreground/82 transition group-hover:text-foreground">
                          {entry.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Index — editorial table of contents */}
      <section id="issues" className="border-b border-border/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-10 grid grid-cols-12 items-baseline gap-6">
            <div className="col-span-12 md:col-span-8">
              <div className="caption">
                <span className="fig-label">目录.</span>
                index
              </div>
              <h3 className="mt-2 font-display text-3xl font-medium tracking-tight text-foreground/90 md:text-4xl">
                八条问题
              </h3>
            </div>
            <div className="col-span-12 text-sm leading-relaxed text-muted-foreground md:col-span-4">
              点标题进入对话。
            </div>
          </div>

          <ol className="list-none border-t border-foreground/20">
            {rest.map((entry) => (
              <li
                key={entry.id}
                className="border-b border-foreground/10 transition-colors hover:bg-[oklch(0.97_0.015_80)]"
              >
                <Link
                  href={chatHref(entry.question)}
                  className="group grid grid-cols-12 items-baseline gap-4 px-1 py-6"
                >
                  <span className="col-span-2 font-display text-[1.75rem] italic leading-none text-primary/80 lnum md:col-span-1">
                    {entry.ordinal}
                  </span>
                  <span className="col-span-10 smcp text-[10px] text-muted-foreground md:col-span-2">
                    {entry.field}
                    <br className="hidden md:inline" />
                    <span className="md:hidden"> · </span>
                    <span className="not-smcp text-foreground/60">{entry.chineseField}</span>
                  </span>
                  <div className="col-span-12 md:col-span-7">
                    <h4 className="font-display text-[1.25rem] font-medium leading-snug text-foreground transition-colors group-hover:text-primary md:text-[1.35rem]">
                      {entry.title}
                    </h4>
                    <p className="mt-1.5 max-w-[52ch] text-[12px] leading-relaxed text-muted-foreground">
                      {entry.question}
                    </p>
                  </div>
                  <span className="col-span-12 text-right font-display text-sm italic text-primary md:col-span-2">
                    对话
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Colophon strip — keep it short, keep it quiet */}
      <section className="border-b border-border/40">
        <div className="mx-auto grid max-w-6xl grid-cols-12 items-baseline gap-6 px-6 py-12">
          <div className="col-span-12 md:col-span-7">
            <h3 className="font-display text-2xl font-medium tracking-tight text-foreground/90 md:text-3xl">
              资料
            </h3>
            <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-muted-foreground">
              <span className="metric-inline">{papers}</span> papers ·
              <span className="metric-inline ml-1">{blogs}</span> blogs · citations · trace
            </p>
          </div>
          <div className="col-span-12 flex flex-col items-start gap-2 text-sm md:col-span-5 md:items-end md:text-right">
            <Link
              href="/engine"
              className="text-foreground underline decoration-primary decoration-[2px] underline-offset-[6px] transition-all hover:decoration-[3px]"
            >
              资料页
            </Link>
            <Link
              href="/chat"
              className="text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
            >
              对话
            </Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="mx-auto flex max-w-6xl items-baseline justify-between px-6 py-6">
          <p className="caption">
            <span className="fig-label">AgentBase.</span>
            {issueMeta.volume} · {issueMeta.number} · {today.getFullYear()}
          </p>
          <p className="smcp text-[10px] text-muted-foreground">fin.</p>
        </div>
      </footer>
    </div>
  );
}
