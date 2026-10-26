"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlobAvatar } from "@/components/BlobAvatar";
import { BotEditor } from "@/components/BotEditor";
import { SettingsModal } from "@/components/SettingsModal";
import { PRIMARY_BOT, newId, type Bot, type Msg, type Settings, type Template } from "@/lib/bots";
import { templateFromHash } from "@/lib/share";

const K = { bots: "grokbot.bots", chats: "grokbot.chats", settings: "grokbot.settings", active: "grokbot.active", sessions: "grokbot.sessions" };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked; the app still works for this session
  }
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [bots, setBots] = useState<Bot[]>([PRIMARY_BOT]);
  const [chats, setChats] = useState<Record<string, Msg[]>>({});
  // One stable session id per conversation (OpenCode Go uses it for routing and prompt caching)
  const [sessions, setSessions] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings>({ apiKey: "", model: "" });
  const [activeId, setActiveId] = useState(PRIMARY_BOT.id);
  const [models, setModels] = useState<string[]>([]);
  const [serverDefault, setServerDefault] = useState("grok-4");
  const [serverHasKey, setServerHasKey] = useState(false);
  const [modelError, setModelError] = useState<string>();
  const [keyChecked, setKeyChecked] = useState(false);
  const [editor, setEditor] = useState<{ bot?: Bot; preset?: Template } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Older saves named the primary Bot "Grok"; rename it to match the app name
    setBots(load(K.bots, [PRIMARY_BOT]).map((b) => (b.primary && b.name === "Grok" ? { ...b, name: PRIMARY_BOT.name } : b)));
    setChats(load(K.chats, {}));
    setSettings(load(K.settings, { apiKey: "", model: "" }));
    setActiveId(load(K.active, PRIMARY_BOT.id));
    setSessions(load(K.sessions, {}));
    // Opened from a share link: offer to add that Bot, then drop the hash from the address bar
    const shared = templateFromHash(window.location.hash);
    if (shared) {
      setEditor({ preset: shared });
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setReady(true);
  }, []);

  useEffect(() => { if (ready) save(K.bots, bots); }, [ready, bots]);
  useEffect(() => { if (ready && !streaming) save(K.chats, chats); }, [ready, chats, streaming]);
  useEffect(() => { if (ready) save(K.settings, settings); }, [ready, settings]);
  useEffect(() => { if (ready) save(K.active, activeId); }, [ready, activeId]);
  useEffect(() => { if (ready) save(K.sessions, sessions); }, [ready, sessions]);

  const keyHeader = useMemo<Record<string, string>>(
    () => {
      const h: Record<string, string> = {};
      if (settings.apiKey) h["x-api-key"] = settings.apiKey;
      if (settings.provider) h["x-provider"] = settings.provider;
      return h;
    },
    [settings.apiKey, settings.provider],
  );

  useEffect(() => {
    if (!ready) return;
    fetch("/api/models", { headers: keyHeader })
      .then((r) => r.json())
      .then((d: { models: string[]; defaultModel: string; hasKey: boolean; error?: string }) => {
        setModels(d.models);
        setServerDefault(d.defaultModel);
        setServerHasKey(d.hasKey && !settings.apiKey);
        setModelError(d.error);
      })
      .catch(() => setModelError("network error"))
      .finally(() => setKeyChecked(true));
  }, [ready, keyHeader, settings.apiKey]);

  const bot = bots.find((b) => b.id === activeId) ?? bots[0];
  const messages = chats[bot.id] ?? [];
  const model = bot.model || settings.model || serverDefault;
  const noKey = keyChecked && !settings.apiKey && !serverHasKey;

  // First visit on a deployment without a server key: ask for the user's own key right away
  const askedForKey = useRef(false);
  useEffect(() => {
    if (noKey && !askedForKey.current) {
      askedForKey.current = true;
      setShowSettings(true);
    }
  }, [noKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const setMessages = useCallback(
    (botId: string, fn: (prev: Msg[]) => Msg[]) => setChats((c) => ({ ...c, [botId]: fn(c[botId] ?? []) })),
    [],
  );

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const botId = bot.id;
    let sessionId = sessions[botId];
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setSessions((all) => ({ ...all, [botId]: sessionId }));
    }
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content: text }];
    setInput("");
    setMessages(botId, () => [...history, { role: "assistant", content: "" }]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": sessionId, ...keyHeader },
        body: JSON.stringify({ model, system: bot.instructions, messages: history }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(botId, (prev) => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
        });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages(botId, (prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `Bot failed to respond. ${(err as Error).message}`, error: true },
        ]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function saveBot(b: Omit<Bot, "id"> & { id?: string }) {
    if (b.id) {
      setBots((all) => all.map((x) => (x.id === b.id ? ({ ...x, ...b } as Bot) : x)));
    } else {
      const created = { ...b, id: newId() } as Bot;
      setBots((all) => [...all, created]);
      setActiveId(created.id);
    }
    setEditor(null);
  }

  function deleteBot(id: string) {
    if (!confirm("Delete this Bot? Its chat history will be removed too.")) return;
    setBots((all) => all.filter((b) => b.id !== id));
    setChats(({ [id]: _, ...rest }) => rest);
    setActiveId(PRIMARY_BOT.id);
    setEditor(null);
  }

  const filtered = bots.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()));

  if (!ready) return <div className="app" />;

  return (
    <div className={`app ${sidebarOpen ? "sidebar-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◐</span>
          <span>NovaBot</span>
        </div>
        <input className="search" placeholder="Search Bots" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="section-label">Bots</div>
        <nav className="bot-list">
          {filtered.map((b) => {
            const last = chats[b.id]?.at(-1)?.content;
            return (
              <button
                key={b.id}
                className={`bot-row ${b.id === bot.id ? "active" : ""}`}
                onClick={() => { setActiveId(b.id); setSidebarOpen(false); }}
              >
                <BlobAvatar color={b.color} eyes={b.eyes} size={40} />
                <span className="bot-meta">
                  <span className="bot-name">{b.name}{b.primary && <span className="tag">Primary</span>}</span>
                  <span className="bot-sub">{last ? last.slice(0, 60) : b.title || "No messages yet"}</span>
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="empty-small">No matching Bots</p>}
        </nav>
        <div className="sidebar-foot">
          <button className="btn primary wide" onClick={() => setEditor({})}>+ New Bot</button>
          <button className="btn ghost wide" onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setSidebarOpen(false)} />

      <main className="chat">
        <header className="chat-head">
          <button className="icon-btn menu" onClick={() => setSidebarOpen(true)} aria-label="Show sidebar">☰</button>
          <BlobAvatar color={bot.color} eyes={bot.eyes} size={34} />
          <div className="chat-title">
            <strong>{bot.name}</strong>
            <select
              className="model-pick"
              aria-label="Model"
              value={bot.model ?? ""}
              disabled={streaming}
              onChange={(e) => {
                const next = e.target.value || undefined;
                setBots((all) => all.map((b) => (b.id === bot.id ? { ...b, model: next } : b)));
              }}
            >
              <option value="">Default ({settings.model || serverDefault})</option>
              {bot.model && !models.includes(bot.model) && <option value={bot.model}>{bot.model}</option>}
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <span className="spacer" />
          <button className="icon-btn" title="Reset this conversation" aria-label="Reset this conversation"
            disabled={!messages.length || streaming}
            onClick={() => {
              if (!confirm("Reset this conversation?")) return;
              setMessages(bot.id, () => []);
              setSessions(({ [bot.id]: _, ...rest }) => rest);
            }}>↺</button>
          <button className="icon-btn" title="Edit Bot" aria-label="Edit Bot" onClick={() => setEditor({ bot })}>✎</button>
        </header>

        <div className="messages">
          {noKey && (
            <div className="banner">
              No API key yet. <button className="link" onClick={() => setShowSettings(true)}>Add your own key in Settings</button> to start chatting.
            </div>
          )}
          {messages.length === 0 ? (
            <div className="empty">
              <BlobAvatar color={bot.color} eyes={bot.eyes} size={96} />
              <h1>{bot.name}</h1>
              <p>{bot.title || "Ready when you are."}</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`msg ${m.role} ${m.error ? "error" : ""}`}>
                {m.role === "assistant" && <BlobAvatar color={bot.color} eyes={bot.eyes} size={28} />}
                <div className="bubble">
                  {m.role === "assistant" ? (
                    m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : <span className="typing"><i /><i /><i /></span>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <textarea
            value={input}
            rows={1}
            placeholder={`Message ${bot.name}`}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          {streaming ? (
            <button type="button" className="send stop" onClick={() => abortRef.current?.abort()} aria-label="Stop">■</button>
          ) : (
            <button type="submit" className="send" disabled={!input.trim()} aria-label="Send">↑</button>
          )}
        </form>
      </main>

      {editor && (
        <BotEditor
          initial={editor.bot}
          preset={editor.preset}
          models={models}
          onSave={saveBot}
          onDelete={editor.bot ? () => deleteBot(editor.bot!.id) : undefined}
          onClose={() => setEditor(null)}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          models={models}
          serverHasKey={serverHasKey}
          modelError={modelError}
          onSave={(s) => { setSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
