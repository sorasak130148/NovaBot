import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken, sameToken } from "@/lib/auth";

// Password gate, active only when APP_PASSWORD is set (e.g. the home server).
export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (cookie && sameToken(cookie, await authToken(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) return new NextResponse("Sign in first", { status: 401 });
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Leave static assets and icons public so the login page can render
  matcher: ["/((?!_next/static|_next/image|icon.svg|apple-icon|manifest.webmanifest).*)"],
};
