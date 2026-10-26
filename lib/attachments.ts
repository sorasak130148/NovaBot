// Images and files attached to a message. Images are sent to the model as vision input;
// documents are turned into text and appended to the message.
import type { Msg } from "./bots";

export type Attachment =
  | { kind: "image"; name: string; dataUrl: string }
  | { kind: "file"; name: string; size: number; text: string; truncated?: boolean };

export const MAX_ATTACHMENTS = 4;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CHARS = 60_000;
const MAX_IMAGE_SIDE = 1600;
// Older images are dropped from the request (kept as a text note) so every turn doesn't resend them
const IMAGES_IN_LAST_N_MESSAGES = 6;

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|ya?ml|toml|ini|env|sql|log|srt|vtt)$/i;
const SERVER_EXT = /\.(pdf|docx)$/i;

export const ACCEPT = "image/*,.pdf,.docx,.txt,.md,.csv,.tsv,.json,.jsonl,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.kt,.swift,.c,.h,.cpp,.cs,.php,.sh,.yml,.yaml,.toml,.ini,.sql,.log,.srt,.vtt";

export function formatBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Downscale and re-encode so photos from phones stay small enough to send and store
async function imageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs would otherwise turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

function clip(text: string) {
  return text.length > MAX_TEXT_CHARS
    ? { text: text.slice(0, MAX_TEXT_CHARS), truncated: true }
    : { text, truncated: false };
}

export async function readAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than ${formatBytes(MAX_FILE_BYTES)}`);
  if (file.type.startsWith("image/")) {
    try {
      return { kind: "image", name: file.name || "image", dataUrl: await imageToDataUrl(file) };
    } catch {
      throw new Error(`${file.name} couldn't be read as an image`);
    }
  }
  if (SERVER_EXT.test(file.name)) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/extract", { method: "POST", body: form });
    if (!res.ok) throw new Error(await res.text());
    const { text } = (await res.json()) as { text: string };
    if (!text.trim()) throw new Error(`No text found in ${file.name} (scanned PDFs need OCR)`);
    return { kind: "file", name: file.name, size: file.size, ...clip(text) };
  }
  if (TEXT_EXT.test(file.name) || file.type.startsWith("text/") || file.type === "application/json") {
    return { kind: "file", name: file.name, size: file.size, ...clip(await file.text()) };
  }
  throw new Error(`${file.name}: this file type isn't supported yet`);
}

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ApiContent = string | Part[];

// Text of a message plus its documents, as the model should read it
export function messageText(m: Msg) {
  const files = (m.attachments ?? []).filter((a) => a.kind === "file");
  if (!files.length) return m.content;
  const blocks = files.map(
    (f) => `<file name="${f.name}"${f.truncated ? ' truncated="true"' : ""}>\n${f.text}\n</file>`,
  );
  return [m.content, ...blocks].filter(Boolean).join("\n\n");
}

// OpenAI-style content: plain text, or text + image parts for recent messages with images
export function apiContent(m: Msg, withImages: boolean): ApiContent {
  const text = messageText(m);
  const images = (m.attachments ?? []).filter((a) => a.kind === "image");
  if (!images.length) return text;
  if (!withImages) return `${text}\n\n[${images.length} image(s) attached earlier]`.trim();
  return [
    ...(text ? [{ type: "text" as const, text }] : []),
    ...images.map((i) => ({ type: "image_url" as const, image_url: { url: i.dataUrl } })),
  ];
}

export function toApiMessages(transcript: Msg[]) {
  const cutoff = transcript.length - IMAGES_IN_LAST_N_MESSAGES;
  return transcript.map((m, i) => ({ role: m.role, content: apiContent(m, i >= cutoff) }));
}
