import { qualityMetrics, ablation } from "@/lib/eval-data";

/**
 * Figure 2 — research-paper style results table + ablation figure.
 * Avoids the generic "metric cards grid" template.
 */
export function EvalDashboard() {
  // scale bars to slightly above the primary value for visual headroom
  const maxNdcg = 0.14;

  return (
    <section id="eval" className="border-t border-border/40 bg-[oklch(0.955_0.015_80)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        {/* Header — asymmetric, left heavy */}
        <div className="grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 md:col-span-8">
            <div className="caption">
              <span className="fig-label">Figure 2.</span>
              全链路 eval · 20-question golden set · vs naive dense-top-k baseline
            </div>
            <h2 className="mt-2 font-display text-3xl md:text-4xl font-medium tracking-tight text-foreground/90">
              没有数字的 RAG 是玄学
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 text-sm text-muted-foreground leading-relaxed">
            20 条 query 覆盖 agent 安全、多智能体协作、工具使用、长期记忆、RLHF、
            planning、knowledge graph 等方向，ground truth 是对应论文的全部 chunks。
            CI 抽 5 题做回归保护，任一指标跌 &gt;2pp 拒合并。
          </div>
        </div>

        <hr className="hairline my-10" />

        {/* Results table — typeset like a paper */}
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display italic text-lg text-foreground/80">
              Table 1 &nbsp;<span className="not-italic font-sans text-sm text-muted-foreground">Retrieval &amp; generation quality</span>
            </h3>
            <span className="smcp text-[10px] text-muted-foreground">
              higher is better
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm tnum border-t border-b border-foreground/20">
              <thead>
                <tr className="smcp text-[10px] text-muted-foreground">
                  <th className="text-left font-normal py-2.5 pr-4 w-[28%]">metric</th>
                  <th className="text-right font-normal py-2.5 px-3 w-[13%]">agentbase</th>
                  <th className="text-right font-normal py-2.5 px-3 w-[13%]">naive</th>
                  <th className="text-right font-normal py-2.5 px-3 w-[12%]">delta</th>
                  <th className="text-left font-normal py-2.5 pl-4">distribution</th>
                </tr>
              </thead>
              <tbody className="border-t border-foreground/10">
                {qualityMetrics.map((m) => {
                  const pct = m.unit === "%" ? m.ours : m.ours * 100;
                  const basePct = m.unit === "%" ? m.base : m.base * 100;
                  return (
                    <tr
                      key={m.label}
                      className="border-t border-foreground/5 hover:bg-[oklch(0.97_0.015_80)] transition-colors"
                    >
                      <td className="py-3 pr-4 text-foreground">{m.label}</td>
                      <td className="py-3 px-3 text-right font-semibold text-primary lnum">
                        {m.ours.toFixed(m.unit === "%" ? 1 : 2)}
                        <span className="text-muted-foreground/70 font-normal">{m.unit}</span>
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground lnum">
                        {m.base.toFixed(m.unit === "%" ? 1 : 2)}
                        <span className="text-muted-foreground/50">{m.unit}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-display italic text-primary/90 lnum">
                        {m.delta}
                      </td>
                      <td className="py-3 pl-4">
                        <div className="databar-track">
                          <div
                            className="absolute left-0 top-0 h-full databar-fill-base"
                            style={{ width: `${basePct}%` }}
                          />
                          <div
                            className="absolute left-0 top-0 h-full databar-fill-ours"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="caption mt-3">
            Bars overlay baseline (muted) and agentbase (terracotta). Higher fills indicate better values.
          </p>
        </div>

        {/* Ablation figure */}
        <div className="mt-16">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display italic text-lg text-foreground/80">
              Table 2 &nbsp;<span className="not-italic font-sans text-sm text-muted-foreground">Ablation — NDCG@10 after component removal</span>
            </h3>
          </div>

          <div className="border-t border-b border-foreground/20 py-4">
            <div className="space-y-1.5">
              {ablation.map((a, i) => {
                const width = (a.ndcg / maxNdcg) * 100;
                const isPrimary = a.tone === "primary";
                const isMuted = a.tone === "muted";
                return (
                  <div
                    key={a.label}
                    className="grid grid-cols-[1.8fr_3.5fr_0.7fr] gap-4 items-center text-[13px] py-1.5"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-display italic text-muted-foreground/60 tnum text-[11px] leading-none w-4">
                        {String.fromCharCode(97 + i)}.
                      </span>
                      <span
                        className={
                          isPrimary
                            ? "font-semibold text-foreground"
                            : isMuted
                              ? "italic text-muted-foreground"
                              : "text-foreground/85"
                        }
                      >
                        {a.label}
                      </span>
                    </div>
                    <div className="relative h-3.5 bg-[oklch(0.93_0.015_75)] overflow-hidden">
                      <div
                        className={
                          isPrimary
                            ? "absolute left-0 top-0 h-full bg-primary"
                            : isMuted
                              ? "absolute left-0 top-0 h-full bg-muted-foreground/35"
                              : "absolute left-0 top-0 h-full bg-primary/55"
                        }
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div
                      className={
                        "text-right tnum lnum " +
                        (isPrimary ? "font-semibold text-primary" : "text-foreground/80")
                      }
                    >
                      {a.ndcg.toFixed(3)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="caption mt-3">
            Rerank is the largest lever (NDCG@10 +0.027 vs dense baseline, Hit@10 +10pp).
            On this 20-query golden set over 28 675 chunks, BM25&apos;s incremental contribution
            after rerank is statistically null — consistent with the 8-query pilot; a larger
            set (and longer queries) would likely separate them.
          </p>
        </div>
      </div>
    </section>
  );
}
