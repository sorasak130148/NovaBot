// Server-side routine runner (server mode). Started once from instrumentation.ts.
import { apiContent } from "../attachments";
import { computeNext } from "../routines";
import { serverUpstream } from "../upstream";
import { appendMessages, getStore, mutate, type StoredRoutine } from "./store";

const TICK_MS = 30_000;
const HISTORY = 20;
const g = globalThis as unknown as { __novabotScheduler?: NodeJS.Timeout; __novabotRunning?: boolean };

async function complete(model: string, messages: { role: string; content: string }[], sessionId: string) {
  const up = serverUpstream();
  if (!up.key) throw new Error("No server API key (XAI_API_KEY)");
  const res = await fetch(`${up.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${up.key}`,
      "User-Agent": "NovaBot/0.1",
      "x-opencode-session": sessionId,
    },
    body: JSON.stringify({ model: model || up.defaultModel, messages, stream: false }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty reply");
  return text;
}

export async function runRoutine(id: string, manual = false) {
  const store = await getStore();
  const r = store.data.routines.find((x) => x.id === id);
  if (!r) throw new Error("Routine not found");
  const bot = store.data.bots.find((b) => b.id === r.botId);
  const now = Date.now();
  const late = !manual && !!r.nextRunAt && now - r.nextRunAt > 2 * 60_000;

  // Advance first so a crash mid-run can't fire the same run twice
  await mutate((d) => {
    const x = d.routines.find((y) => y.id === id) as StoredRoutine | undefined;
    if (!x) return;
    const nextRunAt = computeNext(x.schedule, now);
    x.lastRunAt = now;
    if (!manual || x.nextRunAt === null) x.nextRunAt = nextRunAt;
    if (x.nextRunAt === null) x.enabled = false;
    x.scheduleKey = JSON.stringify([x.schedule, x.enabled]);
    if (!bot) {
      x.enabled = false;
      x.lastError = "Bot was deleted";
    }
  });
  if (!bot) return;

  const history = (store.data.chats[bot.id] ?? []).filter((m) => !m.error && m.content).slice(-HISTORY);
  const userMsg = { role: "user" as const, content: r.prompt, routine: { name: r.name, late } };
  let reply: string;
  let error: string | undefined;
  try {
    reply = await complete(
      bot.model ?? "",
      [{ role: "system", content: bot.instructions }, ...history.map((m) => ({ role: m.role, content: apiContent(m, false) as string })), { role: "user", content: r.prompt }],
      `routine-${r.id}`,
    );
  } catch (err) {
    error = (err as Error).message.slice(0, 200);
    reply = `Routine failed. ${error}`;
  }

  await mutate((d) => {
    appendMessages(d, bot.id, [userMsg, { role: "assistant", content: reply, ...(error ? { error: true } : {}) }]);
    d.unread[bot.id] = true;
    const x = d.routines.find((y) => y.id === id);
    if (x) x.lastError = error;
  });
  console.log(`[novabot] routine "${r.name}" for ${bot.name}: ${error ? `failed (${error})` : "ok"}`);
}

async function tick() {
  if (g.__novabotRunning) return;
  g.__novabotRunning = true;
  try {
    const store = await getStore();
    const due = store.data.routines.filter((r) => r.enabled && r.nextRunAt !== null && r.nextRunAt <= Date.now());
    // One at a time keeps provider usage gentle and the chat order predictable
    for (const r of due) await runRoutine(r.id).catch((e) => console.error("[novabot] routine error", e));
  } finally {
    g.__novabotRunning = false;
  }
}

export function startScheduler() {
  if (g.__novabotScheduler) return;
  g.__novabotScheduler = setInterval(() => void tick(), TICK_MS);
  setTimeout(() => void tick(), 3_000); // catch up anything missed while the server was down
  console.log("[novabot] server routines scheduler started");
}
