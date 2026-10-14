"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { RoomBadge } from "@/components/RoomBadge";
import { TemplateSetup } from "@/components/TemplateSetup";
import { deleteItems, putItem, putItems } from "@/lib/db";
import { TIMETABLE_PROMPT, TimetableSchema } from "@/lib/jarvis";
import { defaultSemester, slotOccurrences, WEEKDAYS, addDays, dayStart, type Slot } from "@/lib/planner";
import { parseClaudeJson } from "@/lib/schema";
import { usePlanner } from "@/lib/usePlanner";

type Draft = Omit<Slot, "id" | "createdAt"> & { id?: string };

function emptyDraft(): Draft {
  return { course: "", code: "", type: "Vorlesung", weekday: 1, start: "10:15", end: "12:00", room: "", ...defaultSemester() };
}

export default function TimetablePage() {
  const p = usePlanner();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importRaw, setImportRaw] = useState("");
  const [showImport, setShowImport] = useState(false);
  const parsed = useMemo(() => (importRaw.trim() ? parseClaudeJson(importRaw, TimetableSchema) : null), [importRaw]);

  if (!p.loaded) return <p className="muted">Lade …</p>;
  const slots = p.data.slots;
  const days = [1, 2, 3, 4, 5, ...(slots.some((s) => s.weekday > 5) ? [6, 7] : [])];

  async function save() {
    if (!draft || !draft.course.trim()) return;
    await putItem("slots", {
      ...draft,
      id: draft.id ?? crypto.randomUUID(),
      course: draft.course.trim(),
      code: draft.code?.trim() || undefined,
      createdAt: Date.now(),
    });
    setDraft(null);
  }

  async function importSlots() {
    if (!parsed?.ok) return;
    const sem = defaultSemester();
    await putItems(
      "slots",
      parsed.data.slots.map((s) => ({ ...s, code: s.code || undefined, ...sem, id: crypto.randomUUID(), createdAt: Date.now() })),
    );
    setImportRaw("");
    setShowImport(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Stundenplan</h1>
          <p className="lede">
            Mit der Nummer aus dem Vorlesungsverzeichnis prüft Jarvis vor jeder Lektion den aktuellen Raum und warnt dich,
            wenn er vom üblichen abweicht.
          </p>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => setDraft(emptyDraft())}>
            Eintrag hinzufügen
          </button>
          <button className="btn" onClick={() => setShowImport((v) => !v)}>
            Aus Foto oder PDF
          </button>
        </div>
      </div>

      {slots.length === 0 && (
        <section className="sheet panel" style={{ marginBottom: 24 }}>
          <TemplateSetup />
        </section>
      )}

      {showImport && (
        <section className="sheet panel" style={{ marginBottom: 24 }}>
          <h2 className="panel-title">Stundenplan über Claude einlesen</h2>
          <ol className="steps">
            <li>
              <h3>Prompt kopieren und mit Foto oder PDF des Stundenplans an Claude schicken</h3>
              <div className="row">
                <CopyButton text={TIMETABLE_PROMPT} label="Prompt kopieren" />
                <a className="btn btn-quiet" href="https://claude.ai/new" target="_blank" rel="noreferrer">
                  claude.ai öffnen
                </a>
              </div>
            </li>
            <li>
              <h3>Antwort hier einfügen</h3>
              <textarea className="answer-box" value={importRaw} onChange={(e) => setImportRaw(e.target.value)} placeholder='{"slots": [...]}' />
              {parsed && !parsed.ok && <p className="error small">{parsed.error}</p>}
              {parsed?.ok && (
                <button className="btn btn-primary" onClick={importSlots}>
                  {parsed.data.slots.length} Einträge übernehmen
                </button>
              )}
            </li>
          </ol>
        </section>
      )}

      {draft && <SlotEditor draft={draft} setDraft={setDraft} onSave={save} />}

      <div className="week">
        {days.map((d) => {
          const daySlots = slots.filter((s) => s.weekday === d).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <section key={d} className="week-day">
              <h2 className="week-day-name">{WEEKDAYS[d - 1]}</h2>
              {daySlots.length === 0 && <p className="muted small">frei</p>}
              {daySlots.map((s) => (
                <SlotCard
                  key={s.id}
                  slot={s}
                  now={p.now}
                  onEdit={() => setDraft({ ...s })}
                  onDelete={() => confirm(`„${s.course}“ am ${WEEKDAYS[s.weekday - 1]} löschen?`) && deleteItems("slots", [s.id])}
                />
              ))}
            </section>
          );
        })}
      </div>

      {slots.length > 0 && (
        <details className="sheet panel" style={{ marginTop: 32 }}>
          <summary>Vorlage Pharmazie erneut übernehmen</summary>
          <TemplateSetup compact />
        </details>
      )}
    </>
  );
}

function SlotCard({ slot, now, onEdit, onDelete }: { slot: Slot; now: number; onEdit: () => void; onDelete: () => void }) {
  // Raum der nächsten Lektion dieses Eintrags
  const next = slotOccurrences(slot, now, addDays(dayStart(now), 21)).find((o) => o.end > now);
  return (
    <article className="slot">
      <div className="slot-time">
        {slot.start}–{slot.end}
      </div>
      <div className="slot-title">{slot.course}</div>
      <div className="small muted">
        {slot.type}
        {slot.code && ` · ${slot.code}`}
        {slot.biweekly && " · 14-täglich"}
      </div>
      <div className="small slot-room">
        {next ? <RoomBadge occ={next} /> : <span className="muted">{slot.room || "Semester vorbei"}</span>}
      </div>
      <div className="row slot-actions">
        <button className="btn btn-quiet" onClick={onEdit}>
          Bearbeiten
        </button>
        <button className="btn btn-quiet" onClick={onDelete}>
          Löschen
        </button>
      </div>
    </article>
  );
}

function SlotEditor({ draft, setDraft, onSave }: { draft: Draft; setDraft: (d: Draft | null) => void; onSave: () => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  return (
    <section className="sheet panel editor-panel">
      <h2 className="panel-title">{draft.id ? "Eintrag bearbeiten" : "Neuer Eintrag"}</h2>
      <div className="form-grid">
        <label className="field span-2">
          <span>Lehrveranstaltung</span>
          <input value={draft.course} onChange={(e) => set("course", e.target.value)} placeholder="z. B. Einführung in die Chemie" autoFocus />
        </label>
        <label className="field">
          <span>Nummer im Vorlesungsverzeichnis</span>
          <input value={draft.code ?? ""} onChange={(e) => set("code", e.target.value)} placeholder="z. B. 10380 oder 10551-07" />
        </label>
        <label className="field">
          <span>Art</span>
          <input value={draft.type} onChange={(e) => set("type", e.target.value)} list="slot-types" />
          <datalist id="slot-types">
            <option value="Vorlesung" />
            <option value="Übung" />
            <option value="Praktikum" />
            <option value="Seminar" />
            <option value="Tutorat" />
          </datalist>
        </label>
        <label className="field">
          <span>Wochentag</span>
          <select value={draft.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>
            {WEEKDAYS.map((w, i) => (
              <option key={w} value={i + 1}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Beginn</span>
          <input type="time" value={draft.start} onChange={(e) => set("start", e.target.value)} />
        </label>
        <label className="field">
          <span>Ende</span>
          <input type="time" value={draft.end} onChange={(e) => set("end", e.target.value)} />
        </label>
        <label className="field">
          <span>Raum (falls ohne Nummer)</span>
          <input value={draft.room} onChange={(e) => set("room", e.target.value)} />
        </label>
        <label className="field">
          <span>Erster Termin ab</span>
          <input type="date" value={draft.from} onChange={(e) => set("from", e.target.value)} />
        </label>
        <label className="field">
          <span>Letzter Termin bis</span>
          <input type="date" value={draft.until} onChange={(e) => set("until", e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={!!draft.biweekly} onChange={(e) => set("biweekly", e.target.checked)} />
          nur alle zwei Wochen
        </label>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={onSave} disabled={!draft.course.trim()}>
          Speichern
        </button>
        <button className="btn btn-quiet" onClick={() => setDraft(null)}>
          Abbrechen
        </button>
      </div>
    </section>
  );
}
