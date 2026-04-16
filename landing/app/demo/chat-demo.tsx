"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PAPERS = 474;
const BLOGS = 258;

type Citation = {
  kind: "Paper" | "Blog";
  title: string;
  href: string;
  meta: string;
  note: string;
};

type DemoScenario = {
  id: string;
  label: string;
  prompt: string;
  summary: string;
  keywords: string[];
  metrics: Array<{ label: string; value: string }>;
  citations: Citation[];
};

const DEMOS: DemoScenario[] = [
  {
    id: "reasoning",
    label: "Reasoning",
    prompt: "When should an agent use ReAct instead of long chain-of-thought?",
    summary: "Contrast action-first loops with deep internal reasoning.",
    keywords: ["react", "reasoning", "chain", "cot", "tool", "agent"],
    metrics: [
      { label: "Retrieval hops", value: "2" },
      { label: "Sources cited", value: "3" },
      { label: "Answer mode", value: "Hybrid" },
    ],
    citations: [
      {
        kind: "Paper",
        title: "SWE-AGILE: A Software Agent Framework for Efficiently Managing Dynamic Reasoning Context",
        href: "http://arxiv.org/abs/2604.11716v1",
        meta: "arXiv 2604.11716",
        note: "Frames ReAct-style agents as useful but insufficient alone, then introduces dynamic reasoning context to avoid context explosion.",
      },
      {
        kind: "Blog",
        title: "LLM Powered Autonomous Agents",
        href: "https://lilianweng.github.io/posts/2023-06-23-agent/",
        meta: "Lilian Weng",
        note: "Summarizes planning, memory, and tool-use patterns that make ReAct-style loops valuable in practice.",
      },
      {
        kind: "Blog",
        title: "Why We Think",
        href: "https://lilianweng.github.io/posts/2025-05-01-thinking/",
        meta: "Lilian Weng",
        note: "Useful background for when extra internal reasoning actually helps instead of becoming expensive theater.",
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    prompt: "How should tool-augmented agents defend against indirect prompt injection?",
    summary: "Show deterministic guardrails at the tool boundary.",
    keywords: ["security", "prompt injection", "indirect", "tool", "defend", "guard"],
    metrics: [
      { label: "Policy checks", value: "4" },
      { label: "Blocked actions", value: "1" },
      { label: "Audit trail", value: "Enabled" },
    ],
    citations: [
      {
        kind: "Paper",
        title: "ClawGuard: A Runtime Security Framework for Tool-Augmented LLM Agents Against Indirect Prompt Injection",
        href: "http://arxiv.org/abs/2604.11790v1",
        meta: "arXiv 2604.11790",
        note: "Argues for deterministic enforcement of user-confirmed rules at every tool-call boundary.",
      },
      {
        kind: "Blog",
        title: "Practices for Governing Agentic AI Systems",
        href: "https://openai.com/index/practices-for-governing-agentic-ai-systems",
        meta: "OpenAI",
        note: "Adds governance framing: approval flows, operational controls, and visible accountability around agent actions.",
      },
      {
        kind: "Blog",
        title: "Extrinsic Hallucinations in LLMs",
        href: "https://lilianweng.github.io/posts/2024-07-07-hallucination/",
        meta: "Lilian Weng",
        note: "Helpful for understanding why external evidence pipelines still need verification and guardrails.",
      },
    ],
  },
  {
    id: "evaluation",
    label: "Evaluation",
    prompt: "What should I measure before shipping an agent knowledge base?",
    summary: "Move from vibes to evaluation and failure audits.",
    keywords: ["evaluation", "measure", "shipping", "knowledge base", "hallucination", "reward"],
    metrics: [
      { label: "Eval dimensions", value: "4" },
      { label: "Failure probes", value: "12" },
      { label: "Citation rate", value: "Tracked" },
    ],
    citations: [
      {
        kind: "Paper",
        title: "Detecting Safety Violations Across Many Agent Traces",
        href: "http://arxiv.org/abs/2604.11806v1",
        meta: "arXiv 2604.11806",
        note: "Shows why auditing across many traces matters when failures are sparse, adversarial, or only visible in aggregate.",
      },
      {
        kind: "Blog",
        title: "Reward Hacking in Reinforcement Learning",
        href: "https://lilianweng.github.io/posts/2024-11-28-reward-hacking/",
        meta: "Lilian Weng",
        note: "Useful framing for how systems optimize the visible metric while quietly betraying the actual goal.",
      },
      {
        kind: "Blog",
        title: "Extrinsic Hallucinations in LLMs",
        href: "https://lilianweng.github.io/posts/2024-07-07-hallucination/",
        meta: "Lilian Weng",
        note: "Grounds the need to score factual support instead of treating polished prose as evidence.",
      },
    ],
  },
];

function normalizeQuery(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function resolveScenario(rawQuery: string | undefined) {
  const query = normalizeQuery(rawQuery);
  if (!query) return DEMOS[0];
  return (
    DEMOS.find(
      (item) => item.id === query || item.prompt.toLowerCase() === query
    ) ??
    DEMOS.find((item) =>
      item.keywords.some((keyword) => query.includes(keyword))
    ) ??
    DEMOS[0]
  );
}

function PresetCard({
  onClick,
  active,
  label,
  prompt,
  summary,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  prompt: string;
  summary: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "block w-full rounded-xl border p-4 text-left transition-colors",
        active
          ? "border-primary/40 bg-primary/8"
          : "border-border/50 bg-card/40 hover:bg-muted/40",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {active ? <Badge variant="secondary">Active</Badge> : null}
      </div>
      <p className="mt-3 text-sm text-foreground">{prompt}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{summary}</p>
    </button>
  );
}

export function ChatDemo() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const initialScenario = useMemo(
    () => resolveScenario(initialQuery),
    [initialQuery]
  );

  const [input, setInput] = useState(initialScenario.prompt);
  const [activeScenario, setActiveScenario] = useState(initialScenario);
  const [isStreaming, setIsStreaming] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usedRAG, setUsedRAG] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runChat = async (question: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setAnswer("");
    setError(null);
    setIsStreaming(true);
    setUsedRAG(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "Unknown error");
        setError(`Request failed (${res.status}): ${text}`);
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            setIsStreaming(false);
            return;
          }
          try {
            const parsed = JSON.parse(payload);
            if (parsed?.data?.answer != null) {
              setAnswer(parsed.data.answer);
            } else if (parsed?.data === true) {
              setIsStreaming(false);
              return;
            } else if (parsed?.message && parsed.code !== 0) {
              setError(`${parsed.message}`);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // user cancelled or unmounted
      } else {
        setError(err?.message || String(err));
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    runChat(input.trim());
  };

  const selectPreset = (scenario: DemoScenario) => {
    setInput(scenario.prompt);
    setActiveScenario(scenario);
    setUsedRAG(false);
    setAnswer("");
    setError(null);
    setTimeout(() => runChat(scenario.prompt), 50);
  };

  return (
    <main className="flex-1">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Back
            </Link>
            <span className="font-mono text-sm font-semibold tracking-wider">
              AGENTBASE / DEMO
            </span>
          </div>
          <Link
            href="https://github.com/2725244134"
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View Source
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary">Live RAGFlow</Badge>
          <Badge variant="outline">{PAPERS}+ papers</Badge>
          <Badge variant="outline">{BLOGS} blogs</Badge>
          <Badge variant="outline">Grounded citations</Badge>
        </div>

        <div className="mt-6 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Ask the corpus
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            This demo streams real answers from the local RAGFlow instance over
            a live subset of papers and blogs. If parsing is still running, it
            may return a temporary notice.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card className="border-border/40 bg-card/60">
            <CardHeader>
              <CardTitle>Try a question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-3">
                <label
                  htmlFor="q"
                  className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Prompt
                </label>
                <input
                  id="q"
                  name="q"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="Ask about reasoning, security, or evaluation"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isStreaming || !input.trim()}
                    className={buttonVariants({ size: "sm" })}
                  >
                    {isStreaming ? "Answering..." : "Run"}
                  </button>
                  {isStreaming && (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                    >
                      Stop
                    </button>
                  )}
                </div>
              </form>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Presets
                  </p>
                </div>
                {DEMOS.map((item) => (
                  <PresetCard
                    key={item.id}
                    onClick={() => selectPreset(item)}
                    active={item.id === activeScenario.id}
                    label={item.label}
                    prompt={item.prompt}
                    summary={item.summary}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/40 bg-card/60">
              <CardContent className="space-y-5 pt-4">
                <div className="flex justify-end">
                  <div className="max-w-2xl rounded-2xl bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground shadow-sm">
                    {input || activeScenario.prompt}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/60 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Agent answer</Badge>
                    <Badge variant="outline">
                      {usedRAG ? "RAGFlow live" : "Preset"}
                    </Badge>
                    {isStreaming && (
                      <Badge variant="secondary">Streaming</Badge>
                    )}
                  </div>

                  {error ? (
                    <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      {error}
                    </div>
                  ) : (
                    <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                      {answer || (
                        <span className="text-muted-foreground">
                          {usedRAG
                            ? "Waiting for first token..."
                            : "Choose a preset or type a question, then click Run."}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {activeScenario.metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-xl border border-border/50 bg-card/50 p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {metric.label}
                        </p>
                        <p className="mt-2 text-xl font-semibold tracking-tight">
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardHeader>
                <CardTitle>Evidence trail</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {activeScenario.citations.map((citation) => (
                  <a
                    key={citation.title}
                    href={citation.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-border/50 bg-background/50 p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{citation.kind}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {citation.meta}
                      </span>
                    </div>
                    <h2 className="mt-3 text-sm font-medium leading-6 text-foreground">
                      {citation.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {citation.note}
                    </p>
                  </a>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardHeader>
                <CardTitle>What this page proves</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground sm:grid-cols-3">
                <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                  The corpus is real: local RAGFlow is indexing a curated subset
                  of the full paper and blog collection.
                </div>
                <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                  The answer format is product-shaped: prompt, response,
                  metrics, and citations live on one screen.
                </div>
                <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                  The preset citations match the uploaded documents so answers
                  are verifiable even while the index is warming up.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
