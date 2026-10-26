"use client";

import { useState } from "react";
import type { Settings } from "@/lib/bots";
import { PROVIDERS, guessProvider, type ProviderId } from "@/lib/providers";

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
  const provider = PROVIDERS.find((p) => p.id === draft.provider);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="sheet-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="editor" onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
          <label htmlFor="provider">Provider</label>
          <select
            id="provider"
            className="select"
            value={draft.provider ?? ""}
            onChange={(e) => setDraft({ ...draft, provider: (e.target.value || undefined) as ProviderId | undefined, model: "" })}
          >
            <option value="">{serverHasKey ? "Server default" : "Choose a provider"}</option>
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <label htmlFor="api-key">API key</label>
          <div className="key-row">
            <input
              id="api-key"
              type={show ? "text" : "password"}
              value={draft.apiKey}
              onChange={(e) => {
                const apiKey = e.target.value;
                // Pick the provider from the key's prefix unless the user already chose a matching one
                const guessed = guessProvider(apiKey);
                const keep = provider && apiKey.startsWith(provider.keyPrefix);
                setDraft({ ...draft, apiKey, provider: keep ? draft.provider : guessed ?? draft.provider });
              }}
              placeholder={serverHasKey ? "Using the server's key" : provider ? `${provider.keyPrefix}...` : "Paste your API key"}
              autoComplete="off"
            />
            <button type="button" className="btn ghost" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</button>
          </div>
          <p className="hint">
            Your key is saved only in this browser. Each message sends it to this site's server, which passes it straight to the
            provider and never stores it.
            {provider && <> Get a key at <a href={provider.keyUrl} target="_blank" rel="noreferrer">{provider.keyUrl.replace("https://", "")}</a>.</>}
          </p>

          <label htmlFor="default-model">Default model</label>
          <input id="default-model" list="settings-models" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder={provider?.defaultModel ?? "Provider default"} />
          <datalist id="settings-models">
            {models.map((m) => <option key={m} value={m} />)}
          </datalist>
          {modelError && <p className="hint warn">Couldn&apos;t load the model list ({modelError}). Check the key and provider.</p>}
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
