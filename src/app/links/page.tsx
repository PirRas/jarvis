"use client";

import { useState } from "react";
import { deleteItems, putItem, putItems } from "@/lib/db";
import { DEFAULT_LINKS, groupLinks } from "@/lib/planner";
import { usePlanner } from "@/lib/usePlanner";

export default function LinksPage() {
  const p = usePlanner();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [group, setGroup] = useState("Eigene");

  if (!p.loaded) return <p className="muted">Lade …</p>;
  const groups = groupLinks(p.links);

  async function add() {
    if (!name.trim() || !url.trim()) return;
    const href = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    await putItem("links", {
      id: crypto.randomUUID(),
      name: name.trim(),
      url: href,
      group: group.trim() || "Eigene",
      order: Math.max(0, ...p.links.map((l) => l.order)) + 1,
    });
    setName("");
    setUrl("");
  }

  async function restoreDefaults() {
    const missing = DEFAULT_LINKS.filter((d) => !p.links.some((l) => l.url === d.url));
    await putItems("links", missing.map((l) => ({ ...l, id: `default-${l.order}` })));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Links</h1>
          <p className="lede">
            Alles, was du im Pharmaziestudium brauchst. ADAM, Online-Services und Outlook lassen sich aus Sicherheitsgründen
            nicht in andere Seiten einbetten, darum öffnen sie sich in einem neuen Tab. Angemeldet bleibst du dort wie gewohnt.
          </p>
        </div>
        <button className="btn" onClick={() => setEditing((v) => !v)}>
          {editing ? "Fertig" : "Bearbeiten"}
        </button>
      </div>

      {editing && (
        <section className="sheet panel editor-panel">
          <h2 className="panel-title">Link hinzufügen</h2>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field span-2">
              <span>Adresse</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </label>
            <label className="field">
              <span>Gruppe</span>
              <input value={group} onChange={(e) => setGroup(e.target.value)} list="link-groups" />
              <datalist id="link-groups">
                {groups.map((g) => (
                  <option key={g.name} value={g.name} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={add} disabled={!name.trim() || !url.trim()}>
              Hinzufügen
            </button>
            <button className="btn btn-quiet" onClick={restoreDefaults}>
              Fehlende Standard-Links wiederherstellen
            </button>
          </div>
        </section>
      )}

      <div className="link-groups">
        {groups.map((g) => (
          <section key={g.name} className="sheet panel">
            <h2 className="panel-title">{g.name}</h2>
            <ul className="link-list">
              {g.items.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.name}
                    <span className="link-host">{hostOf(l.url)}</span>
                  </a>
                  {editing && (
                    <button className="btn btn-quiet" onClick={() => deleteItems("links", [l.id])} aria-label={`${l.name} entfernen`}>
                      Entfernen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
