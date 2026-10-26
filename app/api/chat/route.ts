import { resolveUpstream } from "@/lib/upstream";

export const runtime = "nodejs";

type Body = {
  model?: string;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
};

export async function POST(req: Request) {
  const { baseUrl, key, defaultModel } = resolveUpstream(req);
  if (!key) {
    return new Response("No API key. Add your key in Settings.", { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > 400_000) return new Response("Conversation too long. Reset the chat and try again.", { status: 413 });
  const body = JSON.parse(raw) as Body;
  const sessionId = req.headers.get("x-session-id")?.slice(0, 100);
  const messages = [
    ...(body.system ? [{ role: "system", content: body.system }] : []),
    ...body.messages.slice(-40),
  ];

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "User-Agent": "NovaBot/0.1",
      ...(sessionId ? { "x-opencode-session": sessionId } : {}),
    },
    body: JSON.stringify({ model: body.model || defaultModel, messages, stream: true }),
    signal: req.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(`Upstream error ${upstream.status}: ${text.slice(0, 500)}`, { status: upstream.status || 502 });
  }

  // Convert the SSE stream into a plain text stream of content deltas.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      // Keep reading until something is emitted: reasoning models send many chunks with only
      // `reasoning_content`, and returning from pull() without enqueuing stalls the stream.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        let emitted = false;
        for (const line of lines) {
          const data = line.replace(/^data:\s*/, "").trim();
          if (!line.startsWith("data:") || !data || data === "[DONE]") continue;
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(delta));
              emitted = true;
            }
          } catch {
            // ignore keep-alives / partial frames
          }
        }
        if (emitted) return;
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
}
