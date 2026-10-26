import { COLORS, EYES, type Bot, type Template } from "./bots";

// Share links carry the whole Bot in the URL hash (#bot=...), so nothing is stored server-side
// and the hash never reaches the server.
const HASH_KEY = "bot";

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(data: string) {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// Accept only known fields with sane sizes; anything odd falls back to defaults.
export function sanitizeTemplate(input: unknown): Template | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const name = str(o.name, 50).trim();
  if (!name) return null;
  const color = typeof o.color === "string" && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : COLORS[0].hex;
  const eyes = EYES.includes(o.eyes as Bot["eyes"]) ? (o.eyes as Bot["eyes"]) : "oval";
  const model = str(o.model, 100).trim() || undefined;
  return { name, title: str(o.title, 200), color, eyes, instructions: str(o.instructions, 20_000), model };
}

export function shareLink(bot: Bot, origin: string) {
  const { name, title, color, eyes, instructions, model } = bot;
  return `${origin}/#${HASH_KEY}=${toBase64Url(JSON.stringify({ v: 1, name, title, color, eyes, instructions, model }))}`;
}

export function templateFromHash(hash: string): Template | null {
  const m = hash.match(new RegExp(`[#&]${HASH_KEY}=([A-Za-z0-9_-]+)`));
  if (!m) return null;
  try {
    return sanitizeTemplate(JSON.parse(fromBase64Url(m[1])));
  } catch {
    return null;
  }
}

export function xaiBotId(text: string): string | null {
  return text.match(/x\.ai\/bot\/([A-Za-z0-9_-]{8,64})/)?.[1] ?? null;
}

// Turns whatever the user pasted (NovaBot link, x.ai bot link, or exported JSON) into a draft Bot.
export async function importFromText(text: string): Promise<Template> {
  const trimmed = text.trim();
  const fromHash = templateFromHash(trimmed);
  if (fromHash) return fromHash;

  const xaiId = xaiBotId(trimmed);
  if (xaiId) {
    const res = await fetch(`/api/import-xai?id=${encodeURIComponent(xaiId)}`);
    if (!res.ok) throw new Error(await res.text());
    const t = sanitizeTemplate(await res.json());
    if (!t) throw new Error("That x.ai bot page had no usable details.");
    return t;
  }

  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("That JSON couldn't be read.");
    }
    const t = sanitizeTemplate(parsed);
    if (!t) throw new Error("The JSON needs at least a \"name\".");
    return t;
  }

  throw new Error("Paste a NovaBot share link, an x.ai/bot link, or Bot JSON.");
}
