import { AUTH_COOKIE, authToken, sameToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return Response.json({ ok: true });

  const { password: given } = (await req.json().catch(() => ({}))) as { password?: string };
  // Small fixed delay slows down guessing
  await new Promise((r) => setTimeout(r, 400));
  const expected = await authToken(password);
  if (typeof given !== "string" || !sameToken(await authToken(given), expected)) {
    return new Response("Wrong password", { status: 401 });
  }

  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${AUTH_COOKIE}=${expected}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`,
  );
  return res;
}
