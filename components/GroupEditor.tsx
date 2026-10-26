"use client";

import { useState } from "react";
import { BlobAvatar } from "./BlobAvatar";
import type { Bot, Group } from "@/lib/bots";

type Props = {
  initial?: Group;
  bots: Bot[];
  onSave: (g: { id?: string; name: string; memberIds: string[] }) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export function GroupEditor({ initial, bots, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(initial?.memberIds ?? []);
  const toggle = (id: string) =>
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const valid = name.trim() && memberIds.length >= 2;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={initial ? "Edit Group Chat" : "New Group Chat"}>
        <div className="sheet-head">
          <h2>{initial ? "Edit Group Chat" : "New Group Chat"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form
          className="editor"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSave({ id: initial?.id, name: name.trim(), memberIds });
          }}
        >
          <label htmlFor="group-name">Group name</label>
          <input id="group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Launch Team" maxLength={50} autoFocus />

          <label>Members ({memberIds.length} selected, at least 2)</label>
          <div className="member-list">
            {bots.map((b) => (
              <label key={b.id} className={`member ${memberIds.includes(b.id) ? "on" : ""}`}>
                <input type="checkbox" checked={memberIds.includes(b.id)} onChange={() => toggle(b.id)} />
                <BlobAvatar color={b.color} eyes={b.eyes} size={32} />
                <span className="bot-meta">
                  <span className="bot-name">{b.name}</span>
                  {b.title && <span className="bot-sub">{b.title}</span>}
                </span>
              </label>
            ))}
          </div>
          {bots.length < 2 && <p className="hint warn">Create at least 2 Bots first.</p>}
          <p className="hint">Everyone answers in turn. Type @Name in a message to ask only that Bot.</p>

          <div className="sheet-actions">
            {onDelete && <button type="button" className="btn ghost danger" onClick={onDelete}>Delete Group Chat</button>}
            <span className="spacer" />
            <button type="submit" className="btn primary" disabled={!valid}>{initial ? "Save" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
