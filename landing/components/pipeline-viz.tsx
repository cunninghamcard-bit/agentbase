import { pipeline } from "@/lib/eval-data";

/**
 * Figure 1 — a proper flow diagram rendered as inline SVG with numbered
 * footnotes, instead of the banned "grid of identical cards" template.
 */
export function PipelineViz() {
  const nodes = pipeline;
  const nodeW = 108;
  const nodeH = 54;
  const gapX = 20;
  const totalW = nodes.length * nodeW + (nodes.length - 1) * gapX;
  const viewH = 110;

  return (
    <section id="pipeline" className="border-t border-border/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        {/* Asymmetric header: label on left, eyebrow on right */}
        <div className="grid grid-cols-12 gap-6 items-baseline">
          <div className="col-span-12 md:col-span-8">
            <div className="caption">
              <span className="fig-label">Figure 1.</span>
              end-to-end retrieval pipeline · {nodes.length} stages ·
              <span className="metric-inline ml-1">1.35s</span> p50 retrieve (pre-LLM)
            </div>
            <h2 className="mt-2 font-display text-3xl md:text-4xl font-medium tracking-tight text-foreground/90">
              一条 query，穿过七段流水线
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 text-sm text-muted-foreground leading-relaxed">
            不是套壳。每一段都可替换、可旁路、可 ablation。
            阅读下方脚注看选型与延迟。
          </div>
        </div>

        <hr className="hairline my-10" />

        {/* SVG diagram */}
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${totalW + 40} ${viewH}`}
            width="100%"
            style={{ minWidth: totalW + 40, height: "auto" }}
            role="img"
            aria-label="Retrieval pipeline flow"
          >
            <defs>
              <marker
                id="arrow"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L5,3 L0,6 Z" fill="oklch(0.637 0.165 42)" opacity="0.85" />
              </marker>
            </defs>

            {/* Connectors */}
            {nodes.slice(0, -1).map((_, i) => {
              const x1 = 20 + (i + 1) * nodeW + i * gapX;
              const x2 = 20 + (i + 1) * nodeW + i * gapX + gapX - 6;
              const y = viewH / 2;
              return (
                <line
                  key={`c-${i}`}
                  x1={x1}
                  x2={x2}
                  y1={y}
                  y2={y}
                  stroke="oklch(0.637 0.165 42)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  opacity="0.7"
                  markerEnd="url(#arrow)"
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((n, i) => {
              const x = 20 + i * (nodeW + gapX);
              const y = viewH / 2 - nodeH / 2;
              return (
                <g key={n.id}>
                  <rect
                    x={x}
                    y={y}
                    width={nodeW}
                    height={nodeH}
                    rx="2"
                    fill="oklch(0.985 0.008 85)"
                    stroke="oklch(0.75 0.025 60)"
                    strokeWidth="1"
                  />
                  {/* Stage number — display italic */}
                  <text
                    x={x + 8}
                    y={y + 14}
                    fontFamily="var(--font-display), Georgia, serif"
                    fontStyle="italic"
                    fontSize="9"
                    fill="oklch(0.50 0.025 55)"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </text>
                  {/* Name */}
                  <text
                    x={x + nodeW / 2}
                    y={y + 30}
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="11.5"
                    fontWeight="600"
                    fill="oklch(0.185 0.02 60)"
                  >
                    {n.short}
                  </text>
                  {/* Timing */}
                  <text
                    x={x + nodeW / 2}
                    y={y + 44}
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontSize="9.5"
                    fill="oklch(0.637 0.165 42)"
                  >
                    {n.timing}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Numbered footnotes — editorial, not cards */}
        <ol className="mt-10 grid gap-x-10 gap-y-5 md:grid-cols-2 lg:grid-cols-3 list-none">
          {nodes.map((n, i) => (
            <li key={n.id} className="group">
              <div className="flex items-baseline gap-2">
                <span className="font-display italic text-primary tnum text-sm leading-none">
                  {String(i + 1).padStart(2, "0")}.
                </span>
                <h3 className="text-sm font-semibold text-foreground">{n.name}</h3>
                <span className="ml-auto font-mono text-[10px] text-primary/80 tnum">
                  {n.timing}
                </span>
              </div>
              <p className="mt-1.5 pl-5 text-[12.5px] leading-relaxed text-muted-foreground">
                {n.summary}
              </p>
              {n.oss.length > 0 && (
                <div className="mt-2 pl-5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  {n.oss.map((o) => (
                    <a
                      key={o.name}
                      href={o.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-muted-foreground hover:text-primary transition underline-offset-2 hover:underline"
                    >
                      {o.name}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
