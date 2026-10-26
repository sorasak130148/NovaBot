// Optional single-password gate (APP_PASSWORD). The cookie holds a hash, never the password itself.
export const AUTH_COOKIE = "novabot_auth";

export async function authToken(password: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`novabot:v1:${password}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time compare so response timing doesn't leak how much of a guess matched
export function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
