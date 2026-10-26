"use client";

import { useState } from "react";
import type { Settings } from "@/lib/bots";

type Props = {
  settings: Settings;
  models: string[];
  serverHasKey: boolean;
  modelError?: string;
  onSave: (s: Settings) => void;
  onClose: () => void;
};

export function SettingsModal({ settings, models, serverHasKey, modelError, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings);
  const [show, setShow] = useState(false);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="sheet-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="editor" onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
          <label htmlFor="api-key">xAI API key</label>
          <div className="key-row">
            <input
              id="api-key"
              type={show ? "text" : "password"}
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder={serverHasKey ? "Using server key from .env.local" : "xai-..."}
              autoComplete="off"
            />
            <button type="button" className="btn ghost" onClick={() => setShow((s) => !s)}>{show ? "Hide key" : "Show key"}</button>
          </div>
          <p className="hint">
            Stored only in this browser and sent to this app's own server, which forwards it to xAI. Leave empty to use
            <code>XAI_API_KEY</code> from <code>.env.local</code>. Get a key at console.x.ai.
          </p>

          <label htmlFor="default-model">Default model</label>
          <input id="default-model" list="settings-models" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="grok-4" />
          <datalist id="settings-models">
            {models.map((m) => <option key={m} value={m} />)}
          </datalist>
          {modelError && <p className="hint warn">Couldn't load model list ({modelError}). Check the key.</p>}
          {models.length > 0 && <p className="hint">{models.length} models available on this key.</p>}

          <div className="sheet-actions">
            <span className="spacer" />
            <button type="submit" className="btn primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
