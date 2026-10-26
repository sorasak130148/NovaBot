"use client";

import { useState } from "react";
import { NOVA_MARK_SVG } from "@/lib/novaMark";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(res ? "Wrong password" : "Can't reach NovaBot");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <span className="login-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: NOVA_MARK_SVG }} />
        <h1>NovaBot</h1>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoFocus autoComplete="current-password" aria-label="Password" />
        {error && <p className="hint warn">{error}</p>}
        <button className="btn primary wide" disabled={!password || busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
