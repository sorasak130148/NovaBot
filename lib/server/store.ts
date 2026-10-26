// Server mode: one JSON file on disk holds everything (single user).
// Enabled only when NOVABOT_DATA_DIR is set, e.g. on a home server.
import fs from "node:fs/promises";
import path from "node:path";
import type { Attachment } from "../attachments";
import { PRIMARY_BOT, type Bot, type Group, type Msg } from "../bots";
import { computeNext, type Routine } from "../routines";

// Server keeps a fingerprint of each routine's schedule so it knows when to recompute the next run
export type StoredRoutine = Routine & { scheduleKey?: string };

export type StoreData = {
  bots: Bot[];
  groups: Group[];
  chats: Record<string, Msg[]>;
  routines: StoredRoutine[];
  unread: Record<string, boolean>;
};

type Store = { data: StoreData; rev: number; saveTimer?: NodeJS.Timeout };

const DATA_DIR = process.env.NOVABOT_DATA_DIR;
const MAX_MESSAGES_PER_CHAT = 1000;
const MAX_CONTENT = 100_000;

export const serverMode = () => !!DATA_DIR;

// Route handlers and instrumentation can load this module in separate bundles; keep one copy per process.
const g = globalThis as unknown as { __novabotStore?: Promise<Store> };

function emptyData(): StoreData {
  return { bots: [PRIMARY_BOT], groups: [], chats: {}, routines: [], unread: {} };
}

async function loadStore(): Promise<Store> {
  const file = path.join(DATA_DIR!, "state.json");
  await fs.mkdir(DATA_DIR!, { recursive: true });
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as { rev?: number; data?: Partial<StoreData> };
    return { rev: parsed.rev ?? 1, data: { ...emptyData(), ...parsed.data } };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      // Keep the unreadable file for inspection instead of overwriting it
      await fs.rename(file, `${file}.broken-${Date.now()}`).catch(() => {});
    }
    return { rev: 1, data: emptyData() };
  }
}

export function getStore(): Promise<Store> {
  if (!DATA_DIR) throw new Error("Server mode is off (NOVABOT_DATA_DIR is not set)");
  g.__novabotStore ??= loadStore();
  return g.__novabotStore;
}

async function writeNow(store: Store) {
  const file = path.join(DATA_DIR!, "state.json");
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ rev: store.rev, data: store.data }));
  await fs.rename(tmp, file); // atomic replace, so a crash never leaves half a file
}

// Apply a change in memory, bump the revision and save shortly after (coalescing bursts).
export async function mutate(fn: (data: StoreData) => void): Promise<number> {
  const store = await getStore();
  fn(store.data);
  store.rev += 1;
  clearTimeout(store.saveTimer);
  store.saveTimer = setTimeout(() => void writeNow(store).catch((e) => console.error("[novabot] save failed", e)), 250);
  return store.rev;
}

export function sanitizeMessages(input: unknown): Msg[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, MAX_CONTENT),
      ...(m.error ? { error: true } : {}),
      ...(typeof m.botId === "string" ? { botId: m.botId } : {}),
      ...(m.routine && typeof m.routine.name === "string" ? { routine: { name: m.routine.name.slice(0, 100), late: !!m.routine.late } } : {}),
      ...(Array.isArray(m.attachments) ? { attachments: sanitizeAttachments(m.attachments) } : {}),
    }));
}

function sanitizeAttachments(list: unknown[]): Attachment[] {
  return list
    .slice(0, 4)
    .flatMap((a): Attachment[] => {
      const x = a as Record<string, unknown>;
      const name = String(x.name ?? "file").slice(0, 200);
      if (x.kind === "image" && typeof x.dataUrl === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/.test(x.dataUrl) && x.dataUrl.length < 4_000_000) {
        return [{ kind: "image", name, dataUrl: x.dataUrl }];
      }
      if (x.kind === "file" && typeof x.text === "string") {
        return [{ kind: "file", name, size: Number(x.size) || 0, text: x.text.slice(0, 60_000), truncated: !!x.truncated }];
      }
      return [];
    });
}

export function appendMessages(data: StoreData, conv: string, msgs: Msg[]) {
  data.chats[conv] = [...(data.chats[conv] ?? []), ...msgs].slice(-MAX_MESSAGES_PER_CHAT);
}

const scheduleKey = (r: Routine) => JSON.stringify([r.schedule, r.enabled]);

// The client owns routine definitions; the server owns run state (next/last run, errors).
export function mergeRoutines(existing: StoredRoutine[], incoming: Routine[], now = Date.now()): StoredRoutine[] {
  return incoming.map((r) => {
    const old = existing.find((x) => x.id === r.id);
    const key = scheduleKey(r);
    if (old && old.scheduleKey === key) {
      return { ...r, nextRunAt: old.nextRunAt, lastRunAt: old.lastRunAt, lastError: old.lastError, enabled: old.enabled, scheduleKey: key };
    }
    const nextRunAt = r.enabled ? computeNext(r.schedule, now) : null;
    const enabled = r.enabled && nextRunAt !== null;
    return { ...r, enabled, nextRunAt, lastRunAt: old?.lastRunAt, lastError: old?.lastError, scheduleKey: JSON.stringify([r.schedule, enabled]) };
  });
}

export function publicData(data: StoreData) {
  return { ...data, routines: data.routines.map(({ scheduleKey: _, ...r }) => r) };
}
