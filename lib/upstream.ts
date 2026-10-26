// Server-only helpers for talking to an OpenAI-compatible endpoint.
import { PROVIDERS, type ProviderId } from "./providers";

const ENV_BASE_URL = process.env.XAI_BASE_URL?.replace(/\/$/, "");
const ENV_DEFAULT_MODEL = process.env.DEFAULT_MODEL;

export type Upstream = { baseUrl: string; key: string | null; defaultModel: string };

// Users pick a provider from a fixed allowlist (never a raw URL), so the server can't be used
// as an open proxy. With no provider chosen, the server's own .env settings apply.
export function resolveUpstream(req: Request): Upstream {
  const clientKey = req.headers.get("x-api-key")?.trim() || null;
  const providerId = req.headers.get("x-provider") as ProviderId | null;
  const provider = providerId ? PROVIDERS.find((p) => p.id === providerId) : undefined;

  if (provider) {
    return { baseUrl: provider.baseUrl, key: clientKey, defaultModel: provider.defaultModel };
  }
  return { ...serverUpstream(), key: clientKey || process.env.XAI_API_KEY || null };
}

// The server's own endpoint and key from .env (used by server-side routines).
export function serverUpstream(): Upstream {
  return {
    baseUrl: ENV_BASE_URL || PROVIDERS[0].baseUrl,
    key: process.env.XAI_API_KEY || null,
    defaultModel: ENV_DEFAULT_MODEL || PROVIDERS[0].defaultModel,
  };
}
