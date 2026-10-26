import { appendMessages, mutate, sanitizeMessages, serverMode } from "@/lib/server/store";

export const runtime = "nodejs";

const validConv = (c: unknown): c is string => typeof c === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(c);

// Append finished turns to a conversation
export async function POST(req: Request) {
  if (!serverMode()) return new Response("Server mode is off", { status: 404 });
  const { conv, messages } = (await req.json()) as { conv?: string; messages?: unknown };
  if (!validConv(conv)) return new Response("Bad conversation id", { status: 400 });
  const msgs = sanitizeMessages(messages);
  const rev = await mutate((d) => appendMessages(d, conv, msgs));
  return Response.json({ rev });
}

// Reset or remove a conversation
export async function DELETE(req: Request) {
  if (!serverMode()) return new Response("Server mode is off", { status: 404 });
  const conv = new URL(req.url).searchParams.get("conv");
  if (!validConv(conv)) return new Response("Bad conversation id", { status: 400 });
  const rev = await mutate((d) => {
    delete d.chats[conv];
    delete d.unread[conv];
  });
  return Response.json({ rev });
}
