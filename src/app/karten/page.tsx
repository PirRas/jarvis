"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Md } from "@/components/Md";
import { useRemoteRefresh } from "@/components/SyncBadge";
import { allCards, deleteCard, listLectures, saveCard, type Lecture } from "@/lib/db";
import { formatInterval, newCard, type CardState } from "@/lib/srs";

const QUEUE_LABEL = { new: "Neu", learning: "Lernphase", review: "Wiederholung" } as const;
const KINDS: CardState["kind"][] = ["definition", "konzept", "anwendung", "formel", "fakt"];

function dueText(c: CardState) {
  if (c.suspended) return "zurückgestellt";
  if (c.queue === "new") return "neu";
  const d = c.due - Date.now();
  return d <= 0 ? "jetzt" : `in ${formatInterval(d)}`;
}

function BrowserInner() {
  const params = useSearchParams();
  const [cards, setCards] = useState<CardState[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [deck, setDeck] = useState(params.get("deck") ?? "alle");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(params.get("id"));
  const [draft, setDraft] = useState<CardState | null>(null);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState(0);
  useRemoteRefresh(useCallback(() => setVersion((v) => v + 1), []));

  useEffect(() => {
    Promise.all([allCards(), listLectures()]).then(([c, l]) => {
      setCards(c);
      setLectures(l);
      if (version > 0) return; // nach einem Abgleich nur die Liste auffrischen, nicht den Editor
      const pre = params.get("id");
      const hit = pre ? c.find((x) => x.id === pre) : undefined;
      if (hit) {
        setDraft(hit);
        setDeck(hit.lectureId);
      }
    });
  }, [params, version]);

  const lectureName = useMemo(() => new Map(lectures.map((l) => [l.id, l.title])), [lectures]);
  const needle = q.trim().toLowerCase();
  const shown = cards
    .filter((c) => deck === "alle" || c.lectureId === deck)
    .filter((c) => !needle || `${c.front} ${c.back} ${c.topic}`.toLowerCase().includes(needle))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  function select(c: CardState) {
    setSelected(c.id);
    setDraft(c);
    setSaved(false);
  }

  async function save() {
    if (!draft) return;
    await saveCard(draft);
    setCards((cs) => (cs.some((c) => c.id === draft.id) ? cs.map((c) => (c.id === draft.id ? draft : c)) : [...cs, draft]));
    setSelected(draft.id);
    setSaved(true);
  }

  function addCard() {
    const lectureId = deck !== "alle" ? deck : lectures[0]?.id;
    if (!lectureId) return;
    const c = newCard(lectureId, { front: "", back: "", topic: "Eigene Karten", kind: "fakt" }, `${lectureId}:u${Date.now()}`, true);
    setSelected(c.id);
    setDraft(c);
    setSaved(false);
  }

  async function remove() {
    if (!draft || !confirm("Diese Karte endgültig löschen?")) return;
    await deleteCard(draft.id);
    setCards((cs) => cs.filter((c) => c.id !== draft.id));
    setDraft(null);
    setSelected(null);
  }

  const set = <K extends keyof CardState>(k: K, v: CardState[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    setSaved(false);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Karten</h1>
          <p className="lede">Alle Karteikarten durchsuchen, verbessern, zurückstellen oder eigene hinzufügen.</p>
        </div>
        <button className="btn btn-primary" onClick={addCard} disabled={!lectures.length}>
          Karte hinzufügen
        </button>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <input className="search" placeholder="Suchen in Vorder- und Rückseite" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="field" style={{ minWidth: 220 }}>
          <span className="sr-only">Stapel</span>
          <select value={deck} onChange={(e) => setDeck(e.target.value)}>
            <option value="alle">Alle Vorlesungen</option>
            {lectures.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small">{shown.length} Karten</span>
      </div>

      <div className="browser">
        <div className="sheet table-wrap">
          <table className="browser-table">
            <thead>
              <tr>
                <th>Vorderseite</th>
                <th>Fällig</th>
                {deck === "alle" && <th>Vorlesung</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr
                  key={c.id}
                  className={`${c.id === selected ? "is-selected" : ""} ${c.suspended ? "is-suspended" : ""}`}
                  onClick={() => select(c)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && select(c)}
                >
                  <td>
                    <Md>{c.front || "(leer)"}</Md>
                  </td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {dueText(c)}
                  </td>
                  {deck === "alle" && <td className="muted">{lectureName.get(c.lectureId)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="muted" style={{ padding: 18 }}>Keine Karten gefunden.</p>}
        </div>

        {draft ? (
          <div className="sheet editor">
            <label className="field">
              Vorderseite
              <textarea value={draft.front} onChange={(e) => set("front", e.target.value)} />
            </label>
            <label className="field">
              Rückseite
              <textarea value={draft.back} onChange={(e) => set("back", e.target.value)} />
            </label>
            <div className="row">
              <label className="field" style={{ flex: 1, minWidth: 160 }}>
                Thema
                <input value={draft.topic} onChange={(e) => set("topic", e.target.value)} />
              </label>
              <label className="field">
                Art
                <select value={draft.kind} onChange={(e) => set("kind", e.target.value as CardState["kind"])}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k[0].toUpperCase() + k.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="row small" style={{ fontWeight: 500 }}>
              <input type="checkbox" checked={draft.suspended} onChange={(e) => set("suspended", e.target.checked)} />
              Zurückgestellt (wird nicht abgefragt)
            </label>
            <p className="muted small" style={{ margin: 0 }}>
              {QUEUE_LABEL[draft.queue]}, Intervall {draft.queue === "review" ? formatInterval(draft.interval * 86400000) : "keine Angabe"},
              Leichtigkeit {Math.round(draft.ease * 100)} %, {draft.lapses}× vergessen. Markdown und LaTeX ($…$) möglich.
            </p>
            {(draft.front || draft.back) && (
              <div className="index-card" style={{ minHeight: 0, transform: "none" }}>
                <div className="card-topic">
                  <span>Vorschau</span>
                </div>
                <div className="card-body" style={{ fontSize: "1.1rem" }}>
                  <div className="card-q">
                    <Md>{draft.front}</Md>
                  </div>
                  <Md>{draft.back}</Md>
                </div>
              </div>
            )}
            <div className="row">
              <button className="btn btn-primary" onClick={save} disabled={!draft.front.trim() || !draft.back.trim()}>
                Speichern
              </button>
              {saved && <span className="verdict-ok small">Gespeichert</span>}
              <span style={{ flex: 1 }} />
              <button className="btn btn-danger" onClick={remove}>
                Löschen
              </button>
            </div>
          </div>
        ) : (
          <div className="sheet editor muted">Wähle links eine Karte, um sie zu bearbeiten.</div>
        )}
      </div>
    </>
  );
}

export default function BrowserPage() {
  return (
    <Suspense fallback={<p className="muted">Lade …</p>}>
      <BrowserInner />
    </Suspense>
  );
}
