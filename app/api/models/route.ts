import { BASE_URL, DEFAULT_MODEL, resolveKey } from "@/lib/upstream";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const key = resolveKey(req);
  if (!key) return Response.json({ models: [], defaultModel: DEFAULT_MODEL, hasKey: false });

  const res = await fetch(`${BASE_URL}/models`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    return Response.json({ models: [], defaultModel: DEFAULT_MODEL, hasKey: true, error: `HTTP ${res.status}` });
  }
  const data = (await res.json()) as { data?: { id: string }[] };
  const models = (data.data ?? []).map((m) => m.id).sort();
  return Response.json({ models, defaultModel: DEFAULT_MODEL, hasKey: true });
}
