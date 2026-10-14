"use client";

import { useState } from "react";
import { PushSetup } from "@/components/PushSetup";
import { TodoItem } from "@/components/TodoItem";
import type { Todo } from "@/lib/assistant";
import { deleteItems, putItem } from "@/lib/db";
import { groupTodos, TODO_CATEGORIES } from "@/lib/todos";
import { usePlanner } from "@/lib/usePlanner";

type Draft = Omit<Todo, "id" | "createdAt" | "done"> & { id?: string; createdAt?: number; done?: boolean };

const emptyDraft = (): Draft => ({ title: "", note: "", category: "Eigene", due: "", time: "", link: "" });

export default function TodosPage() {
  const p = usePlanner();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showDone, setShowDone] = useState(false);

  if (!p.loaded) return <p className="muted">Lade …</p>;
  const groups = groupTodos(p.todos, p.now);
  const openCount = p.todos.filter((t) => !t.done).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Aufgaben</h1>
          <p className="lede">
            Was fürs Studium noch zu erledigen ist: Anmeldungen, Fristen, Famulatur und deine eigenen Punkte. Hat eine
            Aufgabe einen Termin, erinnert dich Jarvis eine Woche vorher, einen Tag vorher und am Tag selbst.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setDraft(emptyDraft())}>
          Aufgabe hinzufügen
        </button>
      </div>

      <PushSetup marks={p.marks} />

      {draft && <TodoEditor draft={draft} setDraft={setDraft} />}

      {openCount === 0 && (
        <div className="sheet empty" style={{ marginBottom: 24 }}>
          <h2>Alles erledigt</h2>
          <p className="muted">Keine offenen Aufgaben. Neue fügst du oben hinzu.</p>
        </div>
      )}

      <div className="todo-groups">
        {groups
          .filter((g) => g.key !== "done" || showDone)
          .map((g) => (
            <section key={g.key} className={`todo-group group-${g.key}`}>
              <h2 className="course-title">
                {g.label}
                <span className="muted small">{g.items.length}</span>
              </h2>
              <ul className="sheet todo-list">
                {g.items.map((t) => (
                  <TodoItem key={t.id} todo={t} now={p.now} onEdit={() => setDraft({ ...t })} />
                ))}
              </ul>
            </section>
          ))}
      </div>

      {p.todos.some((t) => t.done) && (
        <button className="btn btn-quiet" style={{ marginTop: 16 }} onClick={() => setShowDone((v) => !v)}>
          {showDone ? "Erledigte ausblenden" : `Erledigte zeigen (${p.todos.filter((t) => t.done).length})`}
        </button>
      )}
    </>
  );
}

function TodoEditor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft | null) => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  async function save() {
    if (!draft.title.trim()) return;
    let link = draft.link?.trim() || undefined;
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
    await putItem("todos", {
      ...draft,
      id: draft.id ?? crypto.randomUUID(),
      title: draft.title.trim(),
      note: draft.note.trim(),
      category: draft.category.trim() || "Eigene",
      due: draft.due || undefined,
      time: draft.due && draft.time ? draft.time : undefined,
      link,
      done: draft.done ?? false,
      createdAt: draft.createdAt ?? Date.now(),
    });
    setDraft(null);
  }

  async function remove() {
    if (!draft.id || !confirm(`„${draft.title}“ löschen?`)) return;
    await deleteItems("todos", [draft.id]);
    setDraft(null);
  }

  return (
    <section className="sheet panel editor-panel">
      <h2 className="panel-title">{draft.id ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</h2>
      <div className="form-grid">
        <label className="field span-2">
          <span>Was ist zu tun?</span>
          <input value={draft.title} onChange={(e) => set("title", e.target.value)} autoFocus placeholder="z. B. Laborkittel kaufen" />
        </label>
        <label className="field">
          <span>Termin (optional)</span>
          <input type="date" value={draft.due ?? ""} onChange={(e) => set("due", e.target.value)} />
        </label>
        <label className="field">
          <span>Uhrzeit (optional)</span>
          <input type="time" value={draft.time ?? ""} onChange={(e) => set("time", e.target.value)} disabled={!draft.due} />
        </label>
        <label className="field">
          <span>Kategorie</span>
          <input list="todo-categories" value={draft.category} onChange={(e) => set("category", e.target.value)} />
          <datalist id="todo-categories">
            {TODO_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Link (optional)</span>
          <input value={draft.link ?? ""} onChange={(e) => set("link", e.target.value)} placeholder="https://…" inputMode="url" />
        </label>
        <label className="field span-2">
          <span>Notiz</span>
          <textarea rows={3} value={draft.note} onChange={(e) => set("note", e.target.value)} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={save} disabled={!draft.title.trim()}>
          Speichern
        </button>
        <button className="btn btn-quiet" onClick={() => setDraft(null)}>
          Abbrechen
        </button>
        {draft.id && (
          <button className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={remove}>
            Löschen
          </button>
        )}
      </div>
    </section>
  );
}
