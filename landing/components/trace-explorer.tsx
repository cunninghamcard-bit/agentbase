import { recentTraces, techStack } from "@/lib/eval-data";

export function TraceExplorer() {
  return (
    <section className="border-t border-border/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid grid-cols-12 gap-6 items-baseline mb-10">
          <div className="col-span-12 md:col-span-8">
            <div className="caption">
              <span className="fig-label">Figure 3.</span>
              per-query JSONL trace · observability is built-in, not bolted on
            </div>
            <h2 className="mt-2 font-display text-3xl md:text-4xl font-medium tracking-tight text-foreground/90">
              一次请求，一条 trace
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 text-sm text-muted-foreground leading-relaxed">
            每阶段 timing、召回来源、cache 命中与引文命中率都落盘。
            查慢查询归因，靠读 JSONL，不靠脑补。
          </div>
        </div>

        {/* Log tail — monospace, tinted alternating rows, no cards */}
        <div className="border-t border-b border-foreground/15 bg-[oklch(0.98_0.012_82)]">
          <div className="grid grid-cols-[80px_1fr_72px_52px_52px] gap-3 px-4 py-2 smcp text-[10px] text-muted-foreground border-b border-foreground/10">
            <div>time</div>
            <div>query</div>
            <div className="text-right">latency</div>
            <div className="text-right">cache</div>
            <div className="text-right">cited</div>
          </div>
          {recentTraces.map((t, i) => (
            <div
              key={t.time}
              className={
                "grid grid-cols-[80px_1fr_72px_52px_52px] gap-3 px-4 py-2 font-mono text-[12px] items-center " +
                (i % 2 === 1 ? "bg-[oklch(0.96_0.015_80)]" : "")
              }
            >
              <div className="text-muted-foreground tnum">{t.time}</div>
              <div className="font-sans text-foreground truncate">{t.query}</div>
              <div className="text-right text-primary tnum">{t.latency}</div>
              <div className="text-right tnum">
                <span
                  className={
                    t.cache === "hit"
                      ? "text-primary italic"
                      : "text-muted-foreground/70"
                  }
                >
                  {t.cache}
                </span>
              </div>
              <div className="text-right text-muted-foreground tnum">{t.cited}</div>
            </div>
          ))}
        </div>

        <p className="caption mt-3">
          A production trace is ~1 KB JSON with <span className="font-mono text-[11px]">timings_ms</span>, <span className="font-mono text-[11px]">retrieved[]</span>, <span className="font-mono text-[11px]">reranked_top_k</span>, and <span className="font-mono text-[11px]">cache_hit</span>. Queryable via <span className="font-mono text-[11px]">duckdb read_json_auto</span>.
        </p>
      </div>
    </section>
  );
}

export function TechStack() {
  return (
    <section className="border-t border-border/40 bg-[oklch(0.955_0.015_80)]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex items-baseline justify-between mb-6">
          <h3 className="font-display italic text-xl text-foreground/80">Colophon</h3>
          <span className="smcp text-[10px] text-muted-foreground">built with</span>
        </div>
        <ul className="grid gap-x-10 gap-y-2.5 sm:grid-cols-2 md:grid-cols-4 text-sm">
          {techStack.map((t) => (
            <li
              key={t.name}
              className="flex items-baseline justify-between gap-2 border-b border-dotted border-foreground/15 pb-2"
            >
              <span className="font-mono text-foreground">{t.name}</span>
              <span className="text-[11px] italic font-display text-muted-foreground text-right">
                {t.role}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
