"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlobAvatar } from "@/components/BlobAvatar";
import { BotEditor } from "@/components/BotEditor";
import { GroupEditor } from "@/components/GroupEditor";
import { RoutinesModal } from "@/components/RoutinesModal";
import { SettingsModal } from "@/components/SettingsModal";
import { PRIMARY_BOT, newId, type Bot, type Group, type Msg, type Settings, type Template } from "@/lib/bots";
import { groupHistory, groupSystemPrompt, pickSpeakers } from "@/lib/group";
import { templateFromHash } from "@/lib/share";
import { NOVA_MARK_SVG } from "@/lib/novaMark";
import { computeNext, type Routine, type Schedule } from "@/lib/routines";

const K = {
  bots: "grokbot.bots",
  groups: "grokbot.groups",
  chats: "grokbot.chats",
  settings: "grokbot.settings",
  active: "grokbot.active",
  sessions: "grokbot.sessions",
  routines: "grokbot.routines",
  unread: "grokbot.unread",
};

// Chats, sessions and the active view are keyed by Bot id, or by Group id (always "g_..." so they never collide)
const isGroupId = (id: string) => id.startsWith("g_");

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

function AvatarStack({ members, size }: { members: Bot[]; size: number }) {
  return (
    <span className="avatar-stack" style={{ width: size + Math.min(members.length - 1, 2) * size * 0.45 }}>
      {members.slice(0, 3).map((b, i) => (
        <span key={b.id} style={{ left: i * size * 0.45, zIndex: 3 - i }}>
          <BlobAvatar color={b.color} eyes={b.eyes} size={size} />
        </span>
      ))}
    </span>
  );
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [bots, setBots] = useState<Bot[]>([PRIMARY_BOT]);
  const [groups, setGroups] = useState<Group[]>([]);
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
  const [groupEditor, setGroupEditor] = useState<{ group?: Group } | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [showRoutines, setShowRoutines] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // The scheduler runs from a long-lived interval, so it reads the latest state through refs
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const streamingRef = useRef(false);
  streamingRef.current = streaming;
  const routinesRef = useRef(routines);
  routinesRef.current = routines;

  useEffect(() => {
    // Older saves named the primary Bot "Grok"; rename it to match the app name
    setBots(load(K.bots, [PRIMARY_BOT]).map((b) => (b.primary && b.name === "Grok" ? { ...b, name: PRIMARY_BOT.name } : b)));
    setGroups(load(K.groups, []));
    setChats(load(K.chats, {}));
    setSettings(load(K.settings, { apiKey: "", model: "" }));
    setActiveId(load(K.active, PRIMARY_BOT.id));
    setSessions(load(K.sessions, {}));
    setRoutines(load(K.routines, []));
    setUnread(load(K.unread, {}));
    // Opened from a share link: offer to add that Bot, then drop the hash from the address bar
    const shared = templateFromHash(window.location.hash);
    if (shared) {
      setEditor({ preset: shared });
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setReady(true);
  }, []);

  useEffect(() => { if (ready) save(K.bots, bots); }, [ready, bots]);
  useEffect(() => { if (ready) save(K.groups, groups); }, [ready, groups]);
  useEffect(() => { if (ready && !streaming) save(K.chats, chats); }, [ready, chats, streaming]);
  useEffect(() => { if (ready) save(K.settings, settings); }, [ready, settings]);
  useEffect(() => { if (ready) save(K.active, activeId); }, [ready, activeId]);
  useEffect(() => { if (ready) save(K.sessions, sessions); }, [ready, sessions]);
  useEffect(() => { if (ready) save(K.routines, routines); }, [ready, routines]);
  useEffect(() => { if (ready) save(K.unread, unread); }, [ready, unread]);

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

  const group = isGroupId(activeId) ? groups.find((g) => g.id === activeId) : undefined;
  const bot = group ? undefined : bots.find((b) => b.id === activeId) ?? bots[0];
  const convId = group?.id ?? bot!.id;
  const members = group ? group.memberIds.map((id) => bots.find((b) => b.id === id)).filter((b): b is Bot => !!b) : [];
  const messages = chats[convId] ?? [];
  const modelFor = (b: Bot) => b.model || settings.model || serverDefault;
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

  // Scheduler: only one tab (the Web Locks holder) runs routines; checks every 20s and on load,
  // so runs missed while the site was closed catch up right away.
  useEffect(() => {
    if (!ready) return;
    let leader = !("locks" in navigator);
    let release: (() => void) | undefined;
    if (!leader) {
      navigator.locks.request("novabot-scheduler", () => {
        leader = true;
        return new Promise<void>((resolve) => (release = resolve));
      });
    }
    const tick = () => {
      if (!leader || streamingRef.current) return;
      const due = routinesRef.current.find((r) => r.enabled && r.nextRunAt !== null && r.nextRunAt <= Date.now());
      if (due) void runRoutineRef.current(due);
    };
    const first = setTimeout(tick, 1500);
    const timer = setInterval(tick, 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      release?.();
    };
  }, [ready]);

  const setMessages = useCallback(
    (id: string, fn: (prev: Msg[]) => Msg[]) => setChats((c) => ({ ...c, [id]: fn(c[id] ?? []) })),
    [],
  );

  function sessionFor(key: string) {
    let id = sessions[key];
    if (!id) {
      id = crypto.randomUUID();
      const created = id;
      setSessions((all) => ({ ...all, [key]: created }));
    }
    return id;
  }

  // Streams one reply into the last message of conversation `id`; returns the full text.
  async function streamInto(id: string, body: { model: string; system: string; messages: { role: string; content: string }[] }, sessionId: string, signal: AbortSignal) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionId, ...keyHeader },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(await res.text());

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      text += chunk;
      setMessages(id, (prev) => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
      });
    }
    return text;
  }

  const failMessage = (err: unknown) => `Bot failed to respond. ${(err as Error).message}`;

  // One reply from a single Bot to `transcript` (which already ends with the user's message).
  // Returns an error message, or null on success/abort.
  async function runBotTurn(b: Bot, transcript: Msg[], signal: AbortSignal): Promise<string | null> {
    setMessages(b.id, () => [...transcript, { role: "assistant", content: "" }]);
    try {
      await streamInto(
        b.id,
        { model: modelFor(b), system: b.instructions, messages: transcript.map(({ role, content }) => ({ role, content })) },
        sessionFor(b.id),
        signal,
      );
      return null;
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      setMessages(b.id, (prev) => [...prev.slice(0, -1), { role: "assistant", content: failMessage(err), error: true }]);
      return (err as Error).message.slice(0, 200);
    }
  }

  async function runRoutine(r: Routine, manual = false) {
    const b = bots.find((x) => x.id === r.botId);
    const now = Date.now();
    const advance = (patch: Partial<Routine>) =>
      setRoutines((all) =>
        all.map((x) => {
          if (x.id !== r.id) return x;
          const nextRunAt = computeNext(x.schedule, now);
          return { ...x, lastRunAt: now, nextRunAt, enabled: x.enabled && nextRunAt !== null, ...patch };
        }),
      );
    if (!b) {
      advance({ enabled: false, lastError: "Bot was deleted" });
      return;
    }
    const late = !manual && !!r.nextRunAt && now - r.nextRunAt > 2 * 60_000;
    const transcript: Msg[] = [
      ...(chatsRef.current[b.id] ?? []).filter((m) => !m.error),
      { role: "user", content: r.prompt, routine: { name: r.name, late } },
    ];
    // Advance first so a crash or reload mid-run can't fire the same run twice
    advance({});
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const error = await runBotTurn(b, transcript, ctrl.signal);
      setRoutines((all) => all.map((x) => (x.id === r.id ? { ...x, lastError: error ?? undefined } : x)));
      if (!manual) {
        setUnread((u) => ({ ...u, [b.id]: true }));
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification(`${b.name} · ${r.name}`, { body: error ? "Routine failed" : "New result is ready", tag: r.id });
        }
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }
  const runRoutineRef = useRef(runRoutine);
  runRoutineRef.current = runRoutine;

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    if (group && members.length === 0) return;
    const id = convId;
    const transcript: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content: text }];
    setInput("");
    setMessages(id, () => transcript);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      if (!group) {
        await runBotTurn(bot!, transcript, ctrl.signal);
        return;
      }

      // Group: speakers answer one after another, each seeing the replies before it
      for (const speaker of pickSpeakers(text, members)) {
        if (ctrl.signal.aborted) break;
        setMessages(id, (prev) => [...prev, { role: "assistant", content: "", botId: speaker.id }]);
        try {
          const reply = await streamInto(
            id,
            {
              model: modelFor(speaker),
              system: groupSystemPrompt(speaker, group, members),
              messages: groupHistory(speaker, transcript, bots),
            },
            sessionFor(`${id}:${speaker.id}`),
            ctrl.signal,
          );
          transcript.push({ role: "assistant", content: reply, botId: speaker.id });
        } catch (err) {
          if ((err as Error).name === "AbortError") break;
          setMessages(id, (prev) => [...prev.slice(0, -1), { role: "assistant", content: failMessage(err), error: true, botId: speaker.id }]);
        }
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function resetConversation() {
    if (!confirm("Reset this conversation?")) return;
    setMessages(convId, () => []);
    setSessions((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== convId && !k.startsWith(`${convId}:`))));
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

  function saveRoutine(d: { id?: string; name: string; prompt: string; schedule: Schedule }) {
    const nextRunAt = computeNext(d.schedule, Date.now());
    if (d.id) {
      setRoutines((all) => all.map((r) => (r.id === d.id ? { ...r, ...d, nextRunAt, enabled: nextRunAt !== null, lastError: undefined } : r)));
    } else {
      setRoutines((all) => [...all, { id: newId(), botId: activeId, name: d.name.trim(), prompt: d.prompt.trim(), schedule: d.schedule, enabled: true, nextRunAt }]);
    }
    // Ask once so finished routines can notify while the tab is in the background
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  }

  function toggleRoutine(id: string) {
    setRoutines((all) =>
      all.map((r) => {
        if (r.id !== id) return r;
        if (r.enabled) return { ...r, enabled: false };
        const nextRunAt = computeNext(r.schedule, Date.now());
        return { ...r, enabled: nextRunAt !== null, nextRunAt };
      }),
    );
  }

  function deleteBot(id: string) {
    if (!confirm("Delete this Bot? Its chat history and routines will be removed too.")) return;
    setBots((all) => all.filter((b) => b.id !== id));
    setRoutines((all) => all.filter((r) => r.botId !== id));
    setGroups((all) => all.map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => m !== id) })));
    setChats(({ [id]: _, ...rest }) => rest);
    setActiveId(PRIMARY_BOT.id);
    setEditor(null);
  }

  function saveGroup(g: { id?: string; name: string; memberIds: string[] }) {
    if (g.id) {
      setGroups((all) => all.map((x) => (x.id === g.id ? { ...x, name: g.name, memberIds: g.memberIds } : x)));
    } else {
      const created: Group = { id: `g_${newId()}`, name: g.name, memberIds: g.memberIds };
      setGroups((all) => [...all, created]);
      setActiveId(created.id);
    }
    setGroupEditor(null);
  }

  function deleteGroup(id: string) {
    if (!confirm("Delete this Group Chat? Its messages will be removed. The Bots stay.")) return;
    setGroups((all) => all.filter((g) => g.id !== id));
    setChats(({ [id]: _, ...rest }) => rest);
    setActiveId(PRIMARY_BOT.id);
    setGroupEditor(null);
  }

  function mention(b: Bot) {
    setInput((v) => `${v}${v && !v.endsWith(" ") ? " " : ""}@${b.name} `);
    inputRef.current?.focus();
  }

  const q = query.toLowerCase();
  const filteredBots = bots.filter((b) => b.name.toLowerCase().includes(q));
  const filteredGroups = groups.filter((g) => g.name.toLowerCase().includes(q));
  const lastPreview = (id: string) => chats[id]?.at(-1)?.content?.slice(0, 60);
  const select = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
    setUnread(({ [id]: _, ...rest }) => rest);
  };
  const botRoutines = bot ? routines.filter((r) => r.botId === bot.id) : [];
  const hasRoutines = (id: string) => routines.some((r) => r.botId === id && r.enabled);

  if (!ready) return <div className="app" />;

  const title = group ? group.name : bot!.name;

  return (
    <div className={`app ${sidebarOpen ? "sidebar-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: NOVA_MARK_SVG }} />
          <span>NovaBot</span>
        </div>
        <input className="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <nav className="bot-list">
          <div className="section-label">Bots</div>
          {filteredBots.map((b) => (
            <button key={b.id} className={`bot-row ${b.id === activeId ? "active" : ""}`} onClick={() => select(b.id)}>
              <BlobAvatar color={b.color} eyes={b.eyes} size={40} />
              <span className="bot-meta">
                <span className="bot-name">
                  {b.name}
                  {b.primary && <span className="tag">Primary</span>}
                  {hasRoutines(b.id) && <span className="routine-mark" title="Has active routines">⏰</span>}
                  {unread[b.id] && b.id !== activeId && <span className="unread-dot" aria-label="New messages" />}
                </span>
                <span className="bot-sub">{lastPreview(b.id) || b.title || "No messages yet"}</span>
              </span>
            </button>
          ))}

          <div className="section-label section-row">
            <span>Group Chats</span>
            <button className="icon-btn small" onClick={() => setGroupEditor({})} aria-label="New Group Chat" title="New Group Chat">+</button>
          </div>
          {filteredGroups.map((g) => {
            const gm = g.memberIds.map((id) => bots.find((b) => b.id === id)).filter((b): b is Bot => !!b);
            return (
              <button key={g.id} className={`bot-row ${g.id === activeId ? "active" : ""}`} onClick={() => select(g.id)}>
                <AvatarStack members={gm} size={28} />
                <span className="bot-meta">
                  <span className="bot-name">{g.name}</span>
                  <span className="bot-sub">{lastPreview(g.id) || gm.map((b) => b.name).join(", ")}</span>
                </span>
              </button>
            );
          })}
          {groups.length === 0 && !q && (
            <button className="empty-small link-row" onClick={() => setGroupEditor({})}>Put 2+ Bots in one chat →</button>
          )}
          {q && filteredBots.length + filteredGroups.length === 0 && <p className="empty-small">No matches</p>}
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
          {group ? <AvatarStack members={members} size={30} /> : <BlobAvatar color={bot!.color} eyes={bot!.eyes} size={34} />}
          <div className="chat-title">
            <strong>{title}</strong>
            {group ? (
              <small>{members.length} Bots · {members.map((b) => b.name).join(", ")}</small>
            ) : (
              <select
                className="model-pick"
                aria-label="Model"
                value={bot!.model ?? ""}
                disabled={streaming}
                onChange={(e) => {
                  const next = e.target.value || undefined;
                  setBots((all) => all.map((b) => (b.id === bot!.id ? { ...b, model: next } : b)));
                }}
              >
                <option value="">Default ({settings.model || serverDefault})</option>
                {bot!.model && !models.includes(bot!.model) && <option value={bot!.model}>{bot!.model}</option>}
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
          <span className="spacer" />
          {!group && (
            <button className="icon-btn routines-btn" title="Routines" aria-label="Routines" onClick={() => setShowRoutines(true)}>
              ⏰{botRoutines.length > 0 && <span className="count">{botRoutines.length}</span>}
            </button>
          )}
          <button className="icon-btn" title="Reset this conversation" aria-label="Reset this conversation"
            disabled={!messages.length || streaming} onClick={resetConversation}>↺</button>
          <button className="icon-btn" title={group ? "Edit Group Chat" : "Edit Bot"} aria-label={group ? "Edit Group Chat" : "Edit Bot"}
            onClick={() => (group ? setGroupEditor({ group }) : setEditor({ bot }))}>✎</button>
        </header>

        <div className="messages">
          {noKey && (
            <div className="banner">
              No API key yet. <button className="link" onClick={() => setShowSettings(true)}>Add your own key in Settings</button> to start chatting.
            </div>
          )}
          {messages.length === 0 ? (
            <div className="empty">
              {group ? <AvatarStack members={members} size={72} /> : <BlobAvatar color={bot!.color} eyes={bot!.eyes} size={96} />}
              <h1>{title}</h1>
              <p>
                {group
                  ? members.length < 2 ? "This group needs at least 2 Bots. Tap ✎ to add some." : "Ask everyone, or @mention one Bot."
                  : bot!.title || "Ready when you are."}
              </p>
            </div>
          ) : (
            messages.map((m, i) => {
              const speaker = m.role === "assistant" ? (group ? bots.find((b) => b.id === m.botId) : bot) : undefined;
              return (
                <div key={i} className={`msg ${m.role} ${m.error ? "error" : ""}`}>
                  {m.role === "assistant" && (
                    speaker ? <BlobAvatar color={speaker.color} eyes={speaker.eyes} size={28} /> : <BlobAvatar color="#8E8E93" eyes="dot" size={28} />
                  )}
                  <div className="bubble">
                    {group && m.role === "assistant" && <div className="speaker">{speaker?.name ?? "Deleted Bot"}</div>}
                    {m.routine && <div className="routine-label">⏰ Routine · {m.routine.name}{m.routine.late ? " · ran late" : ""}</div>}
                    {m.role === "assistant" ? (
                      m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : <span className="typing"><i /><i /><i /></span>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="composer-wrap">
          {group && members.length > 0 && (
            <div className="mention-chips">
              {members.map((b) => (
                <button key={b.id} type="button" className="chip" onClick={() => mention(b)}>
                  <BlobAvatar color={b.color} eyes={b.eyes} size={16} />@{b.name}
                </button>
              ))}
            </div>
          )}
          <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              placeholder={group ? `Message ${group.name}` : `Message ${bot!.name}`}
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
              <button type="submit" className="send" disabled={!input.trim() || (!!group && members.length === 0)} aria-label="Send">↑</button>
            )}
          </form>
        </div>
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
      {showRoutines && bot && (
        <RoutinesModal
          bot={bot}
          routines={botRoutines}
          running={streaming}
          onSave={saveRoutine}
          onDelete={(id) => setRoutines((all) => all.filter((r) => r.id !== id))}
          onToggle={toggleRoutine}
          onRunNow={(id) => {
            const r = routines.find((x) => x.id === id);
            if (r) { setShowRoutines(false); void runRoutine(r, true); }
          }}
          onClose={() => setShowRoutines(false)}
        />
      )}
      {groupEditor && (
        <GroupEditor
          initial={groupEditor.group}
          bots={bots}
          onSave={saveGroup}
          onDelete={groupEditor.group ? () => deleteGroup(groupEditor.group!.id) : undefined}
          onClose={() => setGroupEditor(null)}
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
