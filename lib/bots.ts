import type { ProviderId } from "./providers";

export type Bot = {
  id: string;
  name: string;
  title: string;
  color: string;
  eyes: EyeStyle;
  instructions: string;
  model?: string;
  primary?: boolean;
};

// In group chats, assistant messages record which Bot spoke
export type Msg = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  botId?: string;
  // Set on the prompt a Routine sent; `late` when it ran after its scheduled time (catch-up)
  routine?: { name: string; late?: boolean };
};

export type Group = { id: string; name: string; memberIds: string[] };

export type Settings = { apiKey: string; model: string; provider?: ProviderId };

export type EyeStyle = "oval" | "arc" | "bar" | "dot";

// Palette taken from the Grok Bot app's bot-color options and splash-screen blobs
export const COLORS: { name: string; hex: string }[] = [
  { name: "Purple", hex: "#9159FF" },
  { name: "Orange", hex: "#FF9800" },
  { name: "Red", hex: "#FF2A3C" },
  { name: "Brown", hex: "#93623A" },
  { name: "Cyan", hex: "#22C3B4" },
  { name: "Blue", hex: "#2F7CF6" },
  { name: "Green", hex: "#2DB84D" },
  { name: "Magenta", hex: "#E0409F" },
  { name: "Gray", hex: "#8E8E93" },
  { name: "Black", hex: "#111111" },
];

export const EYES: EyeStyle[] = ["oval", "arc", "bar", "dot"];

export type Template = Omit<Bot, "id" | "primary">;

export const TEMPLATES: Template[] = [
  {
    name: "Chief of Staff",
    title: "Keeps your week on track",
    color: "#9159FF",
    eyes: "oval",
    instructions:
      "You are my Chief of Staff. Turn messy notes into clear priorities, draft follow-ups, and flag anything that needs my decision. Be brief and action-oriented. End with a short 'Next steps' list.",
  },
  {
    name: "Inbox Triage",
    title: "Sorts and drafts replies",
    color: "#FF9800",
    eyes: "bar",
    instructions:
      "You triage email. When I paste emails, classify each as Reply now / Delegate / Archive / Waiting, give a one-line reason, and draft short replies for anything in Reply now.",
  },
  {
    name: "Invoice Chaser",
    title: "Polite, persistent follow-ups",
    color: "#FF2A3C",
    eyes: "bar",
    instructions:
      "You write payment follow-up messages. Ask for client name, amount, due date and how many reminders were sent, then write a reminder whose tone escalates gently with each reminder. Never threaten.",
  },
  {
    name: "Researcher",
    title: "Digs in and summarizes",
    color: "#93623A",
    eyes: "arc",
    instructions:
      "You are a careful researcher. Break questions into parts, state what you know vs. what you're unsure of, and finish with a concise summary. Say plainly when information may be out of date.",
  },
  {
    name: "Customer Support",
    title: "Friendly first-line answers",
    color: "#22C3B4",
    eyes: "oval",
    instructions:
      "You answer customer questions warmly and concisely. Ask one clarifying question when the request is ambiguous. If you can't solve it, write a handoff note for a human agent.",
  },
];

export const PRIMARY_BOT: Bot = {
  id: "primary",
  name: "Nova",
  title: "Your primary Bot",
  color: "#111111",
  eyes: "oval",
  instructions: "You are a helpful, witty assistant. Answer clearly and get to the point.",
  primary: true,
};

// crypto.randomUUID only exists on https/localhost; plain-http LAN access (home server) needs a fallback
export function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
