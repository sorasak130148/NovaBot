"use client";

import { useState } from "react";
import type { Bot } from "@/lib/bots";
import { DAY_NAMES, MIN_INTERVAL_MINUTES, describeSchedule, formatWhen, type Routine, type Schedule } from "@/lib/routines";

type Draft = { id?: string; name: string; prompt: string; schedule: Schedule };

type Props = {
  bot: Bot;
  routines: Routine[];
  running: boolean;
  serverMode?: boolean;
  onSave: (d: Draft) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onRunNow: (id: string) => void;
  onClose: () => void;
};

const KINDS: { kind: Schedule["kind"]; label: string }[] = [
  { kind: "daily", label: "Every day" },
  { kind: "weekdays", label: "Every weekday" },
  { kind: "weekly", label: "Every week on…" },
  { kind: "interval", label: "Every few minutes/hours" },
  { kind: "once", label: "Once" },
];

function defaultSchedule(kind: Schedule["kind"], prev?: Schedule): Schedule {
  const time = prev && "time" in prev ? prev.time : "08:00";
  switch (kind) {
    case "daily":
      return { kind, time };
    case "weekdays":
      return { kind, time };
    case "weekly":
      return { kind, time, days: [1] };
    case "interval":
      return { kind, minutes: 60 };
    case "once": {
      const d = new Date(Date.now() + 60 * 60_000);
      d.setMinutes(0, 0, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      return { kind, at: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00` };
    }
  }
}

const BLANK: Draft = { name: "", prompt: "", schedule: { kind: "daily", time: "08:00" } };

export function RoutinesModal({ bot, routines, running, serverMode, onSave, onDelete, onToggle, onRunNow, onClose }: Props) {
  const [draft, setDraft] = useState<Draft | null>(routines.length ? null : BLANK);
  // Interval unit is UI state; storing only minutes would flip "60 minutes" into "1 hour"
  const [unit, setUnit] = useState<"m" | "h">("h");
  const openDraft = (d: Draft) => {
    if (d.schedule.kind === "interval") setUnit(d.schedule.minutes % 60 === 0 ? "h" : "m");
    setDraft(d);
  };
  const s = (draft ?? BLANK).schedule;
  const setSchedule = (schedule: Schedule) => setDraft((d) => (d ? { ...d, schedule } : d));
  const valid =
    !!draft?.name.trim() &&
    !!draft.prompt.trim() &&
    (s.kind !== "weekly" || s.days.length > 0) &&
    (s.kind !== "once" || new Date(s.at).getTime() > Date.now());

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Routines">
        <div className="sheet-head">
          <h2>{draft ? (draft.id ? "Edit routine" : "New routine") : `${bot.name}'s routines`}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!draft ? (
          <>
            <div className="routine-list">
              {routines.map((r) => (
                <div key={r.id} className={`routine ${r.enabled ? "" : "off"}`}>
                  <div className="routine-main">
                    <strong>{r.name}</strong>
                    <small>{describeSchedule(r.schedule)}</small>
                    <small className="muted">
                      {r.enabled && r.nextRunAt ? `Next run ${formatWhen(r.nextRunAt)}` : r.enabled ? "Finished" : "Paused"}
                      {r.lastRunAt ? ` · Last run ${formatWhen(r.lastRunAt)}` : " · No runs yet"}
                    </small>
                    {r.lastError && <small className="warn">Last run failed: {r.lastError}</small>}
                  </div>
                  <div className="routine-actions">
                    <label className="switch" title={r.enabled ? "Pause" : "Resume"}>
                      <input type="checkbox" checked={r.enabled} onChange={() => onToggle(r.id)} aria-label={`Enable ${r.name}`} />
                      <span />
                    </label>
                    <button className="btn ghost tiny" disabled={running} onClick={() => onRunNow(r.id)}>Run now</button>
                    <button className="btn ghost tiny" onClick={() => openDraft({ id: r.id, name: r.name, prompt: r.prompt, schedule: r.schedule })}>Edit</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="hint">
              {serverMode
                ? "Routines run on your NovaBot server on time, even when every browser is closed."
                : "Routines run while NovaBot is open in a browser tab. Missed runs catch up the next time you open it."}
            </p>
            <div className="sheet-actions">
              <span className="spacer" />
              <button className="btn primary" onClick={() => setDraft(BLANK)}>+ New routine</button>
            </div>
          </>
        ) : (
          <form className="editor" onSubmit={(e) => { e.preventDefault(); if (valid) { onSave(draft); setDraft(null); } }}>
            <label htmlFor="r-name">Routine name</label>
            <input id="r-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Morning briefing" maxLength={60} autoFocus />

            <label htmlFor="r-prompt">What should {bot.name} do?</label>
            <textarea id="r-prompt" rows={4} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
              placeholder="Ex: Give me 3 focus tips for today and one short motivational line." />

            <label htmlFor="r-kind">When</label>
            <select id="r-kind" className="select" value={s!.kind} onChange={(e) => { setUnit("h"); setSchedule(defaultSchedule(e.target.value as Schedule["kind"], s)); }}>
              {KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
            </select>

            {s!.kind === "weekly" && (
              <div className="day-picks">
                {DAY_NAMES.map((n, d) => {
                  const on = (s as Extract<Schedule, { kind: "weekly" }>).days.includes(d);
                  return (
                    <button type="button" key={n} className={`day ${on ? "on" : ""}`}
                      onClick={() => {
                        const w = s as Extract<Schedule, { kind: "weekly" }>;
                        setSchedule({ ...w, days: on ? w.days.filter((x) => x !== d) : [...w.days, d] });
                      }}>{n}</button>
                  );
                })}
              </div>
            )}
            {"time" in s! && (
              <input type="time" aria-label="Time" value={s.time} onChange={(e) => setSchedule({ ...s, time: e.target.value } as Schedule)} required />
            )}
            {s!.kind === "interval" && (
              <div className="key-row">
                <input type="number" aria-label="Every" min={unit === "h" ? 1 : MIN_INTERVAL_MINUTES}
                  value={unit === "h" ? Math.round(s.minutes / 60) : s.minutes}
                  onChange={(e) => {
                    const n = Math.max(1, Math.round(Number(e.target.value)) || 1);
                    setSchedule({ kind: "interval", minutes: unit === "h" ? n * 60 : n });
                  }}
                  onBlur={() => s.minutes < MIN_INTERVAL_MINUTES && setSchedule({ kind: "interval", minutes: MIN_INTERVAL_MINUTES })} />
                <select className="select" aria-label="Unit" value={unit}
                  onChange={(e) => {
                    const u = e.target.value as "m" | "h";
                    setUnit(u);
                    setSchedule({ kind: "interval", minutes: u === "h" ? 60 : 30 });
                  }}>
                  <option value="m">minutes</option>
                  <option value="h">hours</option>
                </select>
              </div>
            )}
            {s!.kind === "once" && (
              <input type="datetime-local" aria-label="Date and time" value={s.at} onChange={(e) => setSchedule({ kind: "once", at: e.target.value })} required />
            )}
            <p className="hint">{describeSchedule(s!)}{s!.kind === "interval" ? ` (minimum ${MIN_INTERVAL_MINUTES} minutes)` : ""}</p>

            <div className="sheet-actions">
              {draft.id && (
                <button type="button" className="btn ghost danger" onClick={() => { onDelete(draft.id!); setDraft(null); }}>Delete</button>
              )}
              <span className="spacer" />
              {(routines.length > 0 || draft.id) && <button type="button" className="btn ghost" onClick={() => setDraft(null)}>Back</button>}
              <button type="submit" className="btn primary" disabled={!valid}>Save</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
