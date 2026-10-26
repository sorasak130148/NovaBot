import type { Bot, Group } from "@/lib/bots";
import type { Routine } from "@/lib/routines";
import { getStore, mergeRoutines, mutate, publicData, serverMode } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!serverMode()) return Response.json({ enabled: false });
  const store = await getStore();
  return Response.json({ enabled: true, rev: store.rev, data: publicData(store.data) });
}

// Replace client-owned collections. Chats are append-only through /api/store/chats.
export async function PUT(req: Request) {
  if (!serverMode()) return new Response("Server mode is off", { status: 404 });
  const body = (await req.json()) as { bots?: Bot[]; groups?: Group[]; routines?: Routine[]; unread?: Record<string, boolean> };
  const rev = await mutate((d) => {
    if (Array.isArray(body.bots) && body.bots.length) d.bots = body.bots;
    if (Array.isArray(body.groups)) d.groups = body.groups;
    if (Array.isArray(body.routines)) d.routines = mergeRoutines(d.routines, body.routines);
    if (body.unread && typeof body.unread === "object") d.unread = body.unread;
  });
  const store = await getStore();
  return Response.json({ rev, routines: publicData(store.data).routines });
}
