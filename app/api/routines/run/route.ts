import { runRoutine } from "@/lib/server/scheduler";
import { serverMode } from "@/lib/server/store";

export const runtime = "nodejs";

// "Run now" in server mode: the server runs it and the client picks up the result by polling
export async function POST(req: Request) {
  if (!serverMode()) return new Response("Server mode is off", { status: 404 });
  const { id } = (await req.json()) as { id?: string };
  if (typeof id !== "string") return new Response("Missing routine id", { status: 400 });
  try {
    await runRoutine(id, true);
    return Response.json({ ok: true });
  } catch (err) {
    return new Response((err as Error).message, { status: 404 });
  }
}
