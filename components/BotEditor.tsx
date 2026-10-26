"use client";

import { useState } from "react";
import { BlobAvatar } from "./BlobAvatar";
import { COLORS, EYES, TEMPLATES, type Bot, type Template } from "@/lib/bots";

type Props = {
  initial?: Bot;
  models: string[];
  onSave: (bot: Omit<Bot, "id"> & { id?: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
};

const BLANK: Template = { name: "", title: "", color: COLORS[0].hex, eyes: "oval", instructions: "" };

export function BotEditor({ initial, models, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Template>(initial ?? BLANK);
  const [step, setStep] = useState<"pick" | "edit">(initial ? "edit" : "pick");
  const set = (patch: Partial<Template>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={initial ? "Edit Bot" : "New Bot"}>
        <div className="sheet-head">
          <h2>{initial ? "Edit Bot" : step === "pick" ? "New Bot" : "Name your Bot"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {step === "pick" ? (
          <div className="templates">
            <button className="template create-own" onClick={() => setStep("edit")}>
              <span className="plus">+</span>
              <span>
                <strong>Create My Own</strong>
                <small>Start from a blank Bot</small>
              </span>
            </button>
            {TEMPLATES.map((t) => (
              <button key={t.name} className="template" onClick={() => { setDraft(t); setStep("edit"); }}>
                <BlobAvatar color={t.color} eyes={t.eyes} size={44} />
                <span>
                  <strong>{t.name}</strong>
                  <small>{t.title}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <form
            className="editor"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.name.trim()) return;
              onSave({ ...initial, ...draft, name: draft.name.trim() });
            }}
          >
            <div className="avatar-preview">
              <BlobAvatar color={draft.color} eyes={draft.eyes} size={88} />
            </div>

            <label>Bot color</label>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  title={c.name}
                  aria-label={c.name}
                  className={`swatch ${draft.color === c.hex ? "on" : ""}`}
                  style={{ background: c.hex }}
                  onClick={() => set({ color: c.hex })}
                />
              ))}
            </div>

            <label>Character</label>
            <div className="swatches">
              {EYES.map((e) => (
                <button type="button" key={e} className={`eye-pick ${draft.eyes === e ? "on" : ""}`} onClick={() => set({ eyes: e })} aria-label={e}>
                  <BlobAvatar color={draft.color} eyes={e} size={34} />
                </button>
              ))}
            </div>

            <label htmlFor="bot-name">Bot name</label>
            <input id="bot-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex: Project Falcon" maxLength={50} autoFocus />

            <label htmlFor="bot-title">Bot title</label>
            <input id="bot-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Describe what your Bot does" />

            <label htmlFor="bot-instr">Bot instructions</label>
            <textarea id="bot-instr" rows={6} value={draft.instructions} onChange={(e) => set({ instructions: e.target.value })} placeholder="How should this Bot behave?" />

            <label htmlFor="bot-model">Model</label>
            <input id="bot-model" list="model-list" value={draft.model ?? ""} onChange={(e) => set({ model: e.target.value || undefined })} placeholder="Default (from Settings)" />
            <datalist id="model-list">
              {models.map((m) => <option key={m} value={m} />)}
            </datalist>

            <div className="sheet-actions">
              {onDelete && !initial?.primary && (
                <button type="button" className="btn ghost danger" onClick={onDelete}>Delete Bot</button>
              )}
              <span className="spacer" />
              {!initial && <button type="button" className="btn ghost" onClick={() => setStep("pick")}>Back</button>}
              <button type="submit" className="btn primary" disabled={!draft.name.trim()}>{initial ? "Save" : "Create"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
