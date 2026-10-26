"use client";

import { useState } from "react";
import { BlobAvatar } from "./BlobAvatar";
import { COLORS, EYES, TEMPLATES, type Bot, type Template } from "@/lib/bots";
import { importFromText, shareLink } from "@/lib/share";

type Props = {
  initial?: Bot;
  // Draft for a new Bot (from a share link or import); opens straight on the edit step
  preset?: Template;
  models: string[];
  onSave: (bot: Omit<Bot, "id"> & { id?: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
};

const BLANK: Template = { name: "", title: "", color: COLORS[0].hex, eyes: "oval", instructions: "" };

export function BotEditor({ initial, preset, models, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Template>(initial ?? preset ?? BLANK);
  const [step, setStep] = useState<"pick" | "import" | "edit">(initial || preset ? "edit" : "pick");
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [copied, setCopied] = useState(false);

  async function runImport() {
    setImporting(true);
    setImportError("");
    try {
      setDraft(await importFromText(importText));
      setStep("edit");
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function copyShare() {
    if (!initial) return;
    // Share what's on screen, including unsaved edits
    const link = shareLink({ ...initial, ...draft }, window.location.origin);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy this link", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const set = (patch: Partial<Template>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={initial ? "Edit Bot" : "New Bot"}>
        <div className="sheet-head">
          <h2>{initial ? "Edit Bot" : preset ? "Add this Bot?" : step === "pick" ? "New Bot" : step === "import" ? "Import Bot" : "Name your Bot"}</h2>
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
            <button className="template create-own" onClick={() => setStep("import")}>
              <span className="plus">↓</span>
              <span>
                <strong>Import Bot</strong>
                <small>From a share link, an x.ai/bot link, or JSON</small>
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
        ) : step === "import" ? (
          <form className="editor" onSubmit={(e) => { e.preventDefault(); runImport(); }}>
            <label htmlFor="import-text">Paste a link or JSON</label>
            <textarea
              id="import-text"
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="https://x.ai/bot/...  or  a NovaBot share link"
              autoFocus
            />
            <p className="hint">
              x.ai bot pages only show the name and description, so NovaBot drafts starter instructions from the
              description. You can edit them before saving.
            </p>
            {importError && <p className="hint warn">{importError}</p>}
            <div className="sheet-actions">
              <button type="button" className="btn ghost" onClick={() => setStep("pick")}>Back</button>
              <span className="spacer" />
              <button type="submit" className="btn primary" disabled={!importText.trim() || importing}>
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          </form>
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
              {initial && (
                <button type="button" className="btn ghost" onClick={copyShare}>{copied ? "Link copied" : "Share"}</button>
              )}
              <span className="spacer" />
              {!initial && !preset && <button type="button" className="btn ghost" onClick={() => setStep("pick")}>Back</button>}
              <button type="submit" className="btn primary" disabled={!draft.name.trim()}>{initial ? "Save" : "Create"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
