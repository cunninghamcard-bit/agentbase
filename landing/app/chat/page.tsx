"use client";

import { Suspense, useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Markdown from "react-markdown";
import { issues } from "@/lib/issues";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  ...issues.slice(0, 6).map((issue) => ({
    title: issue.title,
    question: issue.question,
    tag: issue.chineseField,
  })),
];

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageFallback />}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageFallback() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-border/30 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            返回首页
          </Link>
          <span className="font-display text-sm italic text-foreground/85">AgentBase</span>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="caption">
          <span className="fig-label">载入.</span>
          next question
        </p>
      </div>
    </div>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const consumedSeedRef = useRef("");
  const seededQuestion = searchParams.get("q")?.trim() ?? "";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(
    async (question: string) => {
      if (!question.trim() || streaming) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const userMsg: Message = { role: "user", content: question.trim() };
      setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
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
              if (parsed?.data?.answer != null) {
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = {
                    role: "assistant",
                    content: parsed.data.answer,
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

  useEffect(() => {
    if (!seededQuestion) {
      consumedSeedRef.current = "";
      return;
    }
    if (streaming || consumedSeedRef.current === seededQuestion) return;

    consumedSeedRef.current = seededQuestion;
    setMessages([]);
    void send(seededQuestion);
    router.replace("/chat", { scroll: false });
  }, [router, seededQuestion, send, streaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-border/30 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              首页
            </Link>
            <span className="text-border">|</span>
            <span className="font-display text-sm italic text-foreground/85">AgentBase</span>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                setMessages([]);
              }}
              className="rounded-md border border-border/50 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              新对话
            </button>
          )}
        </div>
      </header>

      {empty ? (
        <div className="flex flex-1 flex-col justify-center px-6 pb-24">
          <div className="mx-auto w-full max-w-3xl">
            <div className="caption flex items-center gap-3">
              <span className="dot-sm" />
              <span className="smcp text-[10.5px]">dialogue</span>
            </div>
            <h1 className="mt-5 max-w-[13ch] font-display text-[clamp(2.25rem,5vw,3.75rem)] font-medium leading-[1.04] tracking-tight text-foreground/95">
              对话
            </h1>
            <p className="mt-5 max-w-[38ch] text-sm leading-7 text-muted-foreground">
              从目录进来，或者直接输入。
            </p>

            <form onSubmit={handleSubmit} className="mt-10 w-full max-w-2xl">
              <div className="search-glow relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入问题"
                  autoFocus
                  className="h-12 w-full rounded-xl border border-border/60 bg-card/60 px-4 pr-20 text-sm outline-none backdrop-blur transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-30"
                >
                  发送
                </button>
              </div>
            </form>

            <div className="mt-8 grid w-full max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item.question}
                  type="button"
                  onClick={() => send(item.question)}
                  className="group rounded-lg border border-border/30 bg-background/60 p-3 text-left transition hover:border-primary/30 hover:bg-card/40"
                >
                  <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {item.tag}
                  </span>
                  <p className="mt-2 font-display text-[15px] leading-snug text-foreground/88 transition group-hover:text-foreground">
                    {item.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8">
            <div className="mx-auto max-w-3xl space-y-8">
              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl bg-primary/10 px-4 py-3 text-sm leading-7 text-foreground/90">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                          <span className="font-mono text-[10px] font-bold text-primary">A</span>
                        </div>
                        <span className="font-display text-xs italic text-muted-foreground">AgentBase</span>
                        {streaming && i === messages.length - 1 && (
                          <span className="text-xs text-muted-foreground animate-pulse">生成中...</span>
                        )}
                      </div>
                      <div className="prose prose-sm prose-neutral max-w-none pl-7 text-sm leading-7 text-foreground/90 prose-a:text-primary prose-headings:text-foreground prose-p:my-1 prose-strong:text-foreground">
                        {msg.content ? (
                          <Markdown>{msg.content}</Markdown>
                        ) : (
                          <span className="animate-pulse text-muted-foreground">...</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="shrink-0 border-t border-border/40 bg-background/85 px-4 py-4 backdrop-blur">
            <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
              <div className="relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="继续输入"
                  className="h-11 w-full rounded-xl border border-border/60 bg-card/40 px-4 pr-24 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  {streaming && (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="rounded-lg border border-border/60 px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
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
