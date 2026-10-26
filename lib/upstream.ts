// Server-only helpers for talking to xAI (or any OpenAI-compatible endpoint).
export const BASE_URL = (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, "");
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "grok-4";

// Key from the user's Settings (sent per request) wins; otherwise fall back to the server env key.
export function resolveKey(req: Request): string | null {
  const fromClient = req.headers.get("x-api-key")?.trim();
  return fromClient || process.env.XAI_API_KEY || null;
}
