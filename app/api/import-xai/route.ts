import { COLORS, EYES } from "@/lib/bots";

export const runtime = "nodejs";

// Reads the public share page of a Grok Bot template (x.ai/bot/<id>). Only the name, creator and
// description are public there; the original instructions aren't, so we draft starter ones.
const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function meta(html: string, prop: string) {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`));
  return m ? decode(m[1]) : "";
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return new Response("Invalid x.ai bot link.", { status: 400 });

  const res = await fetch(`https://x.ai/bot/${id}`, { headers: { "User-Agent": "NovaBot/0.1 (bot import)" } });
  if (!res.ok) return new Response(`Couldn't open that x.ai bot (HTTP ${res.status}).`, { status: 502 });
  const html = await res.text();

  const ogTitle = meta(html, "og:title") || html.match(/<title>([^<]*)<\/title>/)?.[1] || "";
  const by = ogTitle.lastIndexOf(" by ");
  const name = (by > 0 ? ogTitle.slice(0, by) : ogTitle).trim();
  const creator = by > 0 ? ogTitle.slice(by + 4).trim() : "";
  if (!name) return new Response("That x.ai bot page had no bot name.", { status: 422 });

  // Meta descriptions are truncated with "..."; the page body carries the full text in an attribute.
  const short = meta(html, "og:description").replace(/\.\.\.$/, "");
  const prefix = short.slice(0, 40);
  let description = short;
  if (prefix) {
    for (const m of html.matchAll(/="([^"]{20,2000})"/g)) {
      const value = decode(m[1]);
      if (value.startsWith(prefix) && value.length > description.length) description = value;
    }
  }

  // Stable look per bot id so re-imports match
  const hash = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const instructions = [
    `You are ${name}.`,
    description,
    "",
    "Start by asking the user a few short questions about their situation and goals, then help step by step.",
    "Keep answers practical and concise.",
  ].join("\n");

  return Response.json({
    name,
    title: description.slice(0, 200),
    color: COLORS[hash % COLORS.length].hex,
    eyes: EYES[hash % EYES.length],
    instructions,
    source: { url: `https://x.ai/bot/${id}`, creator },
  });
}
