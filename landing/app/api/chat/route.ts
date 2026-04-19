export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

type ChatErrorPayload = {
  code: number;
  message: string;
  data: { answer: string; reference: [] };
};

function encodeEvent(payload: ChatErrorPayload) {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(request: Request) {
  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ code: 400, message: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const question = body?.question?.trim();
  if (!question) {
    return new Response(
      JSON.stringify({ code: 400, message: "Question is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "Unknown error");
          controller.enqueue(
            encodeEvent({
              code: res.status,
              message: text,
              data: {
                answer: `Backend error (${res.status}). Check BACKEND_URL and backend health before retrying.\n\n${text}`,
                reference: [],
              },
            })
          );
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encodeEvent({
            code: 500,
            message,
            data: {
              answer: `Failed to reach backend. Set BACKEND_URL to the FastAPI service and verify /api/health is reachable.\n\n${message}`,
              reference: [],
            },
          })
        );
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
