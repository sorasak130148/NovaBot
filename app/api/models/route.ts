import { resolveUpstream } from "@/lib/upstream";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { baseUrl, key, defaultModel } = resolveUpstream(req);
  if (!key) return Response.json({ models: [], defaultModel, hasKey: false });

  const res = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${key}`, "User-Agent": "NovaBot/0.1" } });
  if (!res.ok) {
    return Response.json({ models: [], defaultModel, hasKey: true, error: `HTTP ${res.status}` });
  }
  const data = (await res.json()) as { data?: { id: string }[] };
  const models = (data.data ?? []).map((m) => m.id).sort();
  return Response.json({ models, defaultModel, hasKey: true });
}
