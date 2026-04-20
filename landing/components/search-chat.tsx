"use client";

import { useState, useRef, useCallback } from "react";
import Markdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function ThinkingIndicator() {
  return (
    <span className="inline-flex items-center gap-2">
      <ThinkingDots />
      <span className="text-[11px] text-muted-foreground/80">正在思考中</span>
    </span>
  );
}

function ThinkingDots() {
  return (
    <span className="flex gap-[3px]">
      <span
        className="inline-block h-[5px] w-[5px] rounded-full bg-primary/70"
        style={{ animation: "pulse 1.4s ease-in-out infinite" }}
      />
      <span
        className="inline-block h-[5px] w-[5px] rounded-full bg-primary/70"
        style={{ animation: "pulse 1.4s ease-in-out infinite", animationDelay: "0.2s" }}
      />
      <span
        className="inline-block h-[5px] w-[5px] rounded-full bg-primary/70"
        style={{ animation: "pulse 1.4s ease-in-out infinite", animationDelay: "0.4s" }}
      />
    </span>
  );
}

const TRENDING = [
  {
    question: "ReAct 和 Chain-of-Thought 有什么区别？",
    tag: "推理",
  },
  {
    question: "多智能体系统如何实现可靠通信？",
    tag: "多智能体",
  },
  {
    question: "针对间接提示注入有哪些防御手段？",
    tag: "安全",
  },
  {
    question: "ToolFormer 如何让 LLM 学会使用工具？",
    tag: "工具调用",
  },
  {
    question: "RAG 系统的检索质量如何评估？",
    tag: "RAG",
  },
  {
    question: "Agent 的长期记忆机制如何设计？",
    tag: "记忆",
  },
];

const TOPICS = [
  { label: "ReAct & 推理", query: "ReAct reasoning agent" },
  { label: "多智能体系统", query: "multi-agent communication" },
  { label: "工具调用", query: "tool use function calling LLM" },
  { label: "RAG 检索增强", query: "RAG retrieval augmented generation" },
  { label: "提示工程", query: "prompt engineering techniques" },
  { label: "安全与对齐", query: "AI agent safety alignment" },
  { label: "代码生成", query: "code generation agent" },
  { label: "规划与记忆", query: "agent planning memory" },
];

export function SearchChat({ papersCount = 0, blogsCount = 0 }: { papersCount?: number; blogsCount?: number }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (question: string) => {
      if (!question.trim() || streaming) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const userMsg: Message = { role: "user", content: question.trim() };
      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "" },
      ]);
      setInput("");
      setStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim() }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "Request failed");
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: `Error: ${text}`,
            };
            return next;
          });
          setStreaming(false);
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
            if (payload === "[DONE]") break;
            try {
              const parsed = JSON.parse(payload);
              const answer =
                typeof parsed?.answer === "string"
                  ? parsed.answer
                  : typeof parsed?.data?.answer === "string"
                    ? parsed.data.answer
                    : null;

              if (answer != null) {
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = {
                    role: "assistant",
                    content: answer,
                  };
                  return next;
                });
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          };
          return next;
        });
      } finally {
        setStreaming(false);
      }
    },
    [streaming],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const empty = messages.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      {/* Empty state: compact hero + trending questions */}
      {empty && (
        <>
          {/* Hero search */}
          <div className="flex flex-col items-center px-6 pt-16 pb-12 hero-grid">
            <div className="mb-2 font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground">
              AgentBase
            </div>
            <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              你想了解什么？
            </h1>
            <p className="mt-3 text-center text-sm text-muted-foreground max-w-md">
              搜索 {papersCount} 篇 arXiv 论文和 {blogsCount} 篇前沿技术博客，涵盖 AI Agent、
              推理、工具使用与多智能体系统。
            </p>

            <form onSubmit={handleSubmit} className="mt-8 w-full max-w-2xl">
              <div className="relative search-glow">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入你的研究问题..."
                  className="h-12 w-full rounded-xl border border-border/60 bg-card/60 px-4 pr-20 text-sm outline-none backdrop-blur transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-30"
                >
                  搜索
                </button>
              </div>
            </form>

            {/* Topic tags */}
            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-2xl">
              {TOPICS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => send(t.query)}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary transition hover:bg-primary/10 hover:border-primary/30"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trending questions */}
          <div className="border-t border-border/30 bg-card/20">
            <div className="mx-auto max-w-6xl px-6 py-12">
              <div className="flex items-baseline justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">热门问题</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    AI Agent 领域的核心研究问题，点击即可开始探索
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TRENDING.map((item) => (
                  <button
                    key={item.question}
                    type="button"
                    onClick={() => send(item.question)}
                    className="group rounded-lg border border-border/30 bg-background/60 p-4 text-left transition hover:border-primary/30 hover:bg-card/40"
                  >
                    <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {item.tag}
                    </span>
                    <p className="mt-2 text-sm font-medium leading-snug group-hover:text-foreground transition">
                      {item.question}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground/60 group-hover:text-primary transition">
                      点击搜索
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Conversation state */}
      {!empty && (
        <>
          {/* Back to home bar */}
          <div className="border-b border-border/30 bg-background/80 px-6 py-2">
            <div className="mx-auto max-w-3xl flex items-center gap-3">
              <button
                type="button"
                onClick={() => { abortRef.current?.abort(); setMessages([]); }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                新搜索
              </button>
              <span className="text-xs text-muted-foreground/50">|</span>
              <span className="text-xs text-muted-foreground/60 truncate">
                {messages.find((m) => m.role === "user")?.content}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl bg-primary/10 px-4 py-3 text-sm">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-[10px] font-mono font-bold text-primary">
                            A
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          AgentBase
                        </span>
                        {streaming && i === messages.length - 1 && <ThinkingIndicator />}
                      </div>
                      <div className="pl-7 text-sm leading-7 text-foreground/90 prose prose-sm prose-neutral max-w-none prose-p:my-1 prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary">
                        {msg.content ? (
                          <Markdown>{msg.content}</Markdown>
                        ) : (
                          <ThinkingDots />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Input bar at bottom */}
          <div className="border-t border-border/40 bg-background/80 backdrop-blur px-6 py-4">
            <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
              <div className="relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="继续提问..."
                  className="h-11 w-full rounded-xl border border-border/60 bg-card/40 px-4 pr-20 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {streaming && (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="rounded-lg border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      停止
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!input.trim() || streaming}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-30"
                  >
                    发送
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
