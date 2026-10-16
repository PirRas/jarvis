"use client";

import { useMemo, useState } from "react";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { deleteFeedCache, deleteItems, putItem, putItems } from "@/lib/db";
import { fetchFeed, refreshFeeds } from "@/lib/feeds";
import { toIcs } from "@/lib/ics";
import {
  addDays,
  dayStart,
  DAYMS,
  fmtDay,
  fmtShortDay,
  fmtTime,
  isoDate,
  KIND_LABEL,
  knownCourses,
  occurrences,
  parseIsoDate,
  parseTime,
  weekStart,
  type CalEvent,
  type EventKind,
  type Feed,
} from "@/lib/planner";
import { findDates, type FoundDate } from "@/lib/textDates";
import { isTimetableUrl, TIMETABLE_FEED_ID, TIMETABLE_FEED_NAME } from "@/lib/timetable";
import { usePlanner } from "@/lib/usePlanner";

type Panel = null | "event" | "text" | "feeds";

export default function CalendarPage() {
  const p = usePlanner();
  const [from, setFrom] = useState(() => weekStart(Date.now()));
  const [panel, setPanel] = useState<Panel>(null);

  if (!p.loaded) return <p className="muted">Lade …</p>;
  const courses = knownCourses(p.data, p.lectures.map((l) => l.course));
  const to = addDays(from, 14);
  const list = occurrences(p.data, from, to, courses);
  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i));

  function exportIcs() {
    const all = occurrences(p.data, addDays(Date.now(), -30), addDays(Date.now(), 240), courses);
    const blob = new Blob([toIcs(all)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jarvis-kalender.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const toggle = (x: Panel) => setPanel((cur) => (cur === x ? null : x));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Kalender</h1>
          <p className="lede">Stundenplan, eigene Termine, Prüfungen und abonnierte Kalender (z. B. ADAM) an einem Ort.</p>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => toggle("event")}>
            Termin hinzufügen
          </button>
          <button className="btn" onClick={() => toggle("text")}>
            Termine aus Text erkennen
          </button>
          <button className="btn" onClick={() => toggle("feeds")}>
            Kalender abonnieren
          </button>
          <button className="btn btn-quiet" onClick={exportIcs} title="Für Handy-Kalender, Outlook oder Google">
            Als .ics exportieren
          </button>
        </div>
      </div>

      {panel === "event" && <EventEditor courses={courses} onDone={() => setPanel(null)} />}
      {panel === "text" && <TextImport courses={courses} onDone={() => setPanel(null)} />}
      {panel === "feeds" && <Feeds p={p} />}

      <div className="row spread cal-nav">
        <div className="row">
          <button className="btn btn-quiet" onClick={() => setFrom(addDays(from, -7))} aria-label="Woche zurück">
            ‹
          </button>
          <button className="btn btn-quiet" onClick={() => setFrom(weekStart(Date.now()))}>
            Heute
          </button>
          <button className="btn btn-quiet" onClick={() => setFrom(addDays(from, 7))} aria-label="Woche vor">
            ›
          </button>
        </div>
        <span className="muted small">
          {fmtShortDay(from)}–{fmtShortDay(addDays(to, -1))}
        </span>
      </div>

      <div className="cal-days">
        {days.map((d) => {
          const items = list.filter((o) => o.start < d + DAYMS && o.end > d);
          const isToday = d === dayStart(p.now);
          if (!items.length && !isToday && new Date(d).getDay() % 6 === 0) return null; // leere Wochenenden ausblenden
          return (
            <section key={d} className={`cal-day sheet ${isToday ? "is-today" : ""}`}>
              <h2 className="cal-day-name">{fmtDay(d)}</h2>
              {items.length ? (
                <ul className="occ-list">
                  {items.map((o) => (
                    <OccurrenceRow
                      key={o.key}
                      o={o}
                      now={p.now}
                      onDelete={
                        o.origin.kind === "event"
                          ? () =>
                              confirm(o.key.split(":").length > 2 ? `Serie „${o.title}“ löschen?` : `„${o.title}“ löschen?`) && deleteItems("events", [o.origin.id])
                          : undefined
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p className="muted small">frei</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

// ---------- Eigener Termin ----------

function EventEditor({ courses, onDone }: { courses: string[]; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<EventKind>("other");
  const [course, setCourse] = useState("");
  const [date, setDate] = useState(isoDate(Date.now()));
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("10:15");
  const [end, setEnd] = useState("12:00");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [weekly, setWeekly] = useState(false);
  const [until, setUntil] = useState("");

  async function save() {
    const day = parseIsoDate(date);
    const s = allDay ? day : day + parseTime(start) * 60_000;
    const e = allDay ? null : day + parseTime(end) * 60_000;
    await putItem("events", {
      id: crypto.randomUUID(),
      title: title.trim() || KIND_LABEL[kind],
      course,
      kind,
      start: s,
      end: e && e > s ? e : null,
      allDay,
      location,
      note,
      source: "manual",
      ...(weekly ? { repeat: { every: "week" as const, ...(until >= date ? { until } : {}) } } : {}),
      createdAt: Date.now(),
    });
    onDone();
  }

  return (
    <section className="sheet panel editor-panel">
      <h2 className="panel-title">Neuer Termin</h2>
      <div className="form-grid">
        <label className="field span-2">
          <span>Titel</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Prüfung Mathematik I" autoFocus />
        </label>
        <label className="field">
          <span>Art</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
            {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <CourseField courses={courses} value={course} onChange={setCourse} />
        <label className="field">
          <span>Datum</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          ganztägig
        </label>
        {!allDay && (
          <>
            <label className="field">
              <span>Beginn</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field">
              <span>Ende</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </>
        )}
        <label className="check">
          <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
          Jede Woche wiederholen
        </label>
        {weekly && (
          <label className="field">
            <span>bis (optional)</span>
            <input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>Ort</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label className="field span-2">
          <span>Notiz</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={save}>
          Speichern
        </button>
        <button className="btn btn-quiet" onClick={onDone}>
          Abbrechen
        </button>
      </div>
    </section>
  );
}

function CourseField({ courses, value, onChange }: { courses: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>Fach (für Lernstand und Countdown)</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} list="course-list" />
      <datalist id="course-list">
        {courses.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </label>
  );
}

// ---------- Termine aus Text ----------

type Candidate = FoundDate & { take: boolean; course: string };

function TextImport({ courses, onDone }: { courses: string[]; onDone: () => void }) {
  const [text, setText] = useState("");
  const [edits, setEdits] = useState<Record<number, Partial<Candidate>>>({});
  const found = useMemo(() => findDates(text), [text]);
  const candidates: Candidate[] = found.map((f, i) => ({
    ...f,
    take: f.start >= dayStart(Date.now()) - DAYMS,
    course: courses.find((c) => f.context.toLowerCase().includes(c.toLowerCase())) ?? "",
    ...edits[i],
  }));
  const edit = (i: number, patch: Partial<Candidate>) => setEdits({ ...edits, [i]: { ...edits[i], ...patch } });

  async function save() {
    const now = Date.now();
    const events: CalEvent[] = candidates
      .filter((c) => c.take)
      .map((c) => ({
        id: `text-${c.start}-${c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        title: c.title,
        course: c.course,
        kind: c.kind,
        start: c.start,
        end: c.end,
        allDay: c.allDay,
        location: "",
        note: c.context,
        source: "text",
        createdAt: now,
      }));
    await putItems("events", events);
    onDone();
  }

  return (
    <section className="sheet panel editor-panel">
      <h2 className="panel-title">Termine aus Text erkennen</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Kopiere eine Ankündigung aus ADAM, eine Mail oder die Prüfungsübersicht aus den Online-Services hier hinein. Jarvis
        findet Daten und Uhrzeiten und erkennt Prüfungen und Fristen.
      </p>
      <textarea className="answer-box" value={text} onChange={(e) => setText(e.target.value)} placeholder="Text hier einfügen …" autoFocus />
      {text.trim() && !candidates.length && <p className="muted">Keine Daten gefunden.</p>}
      {candidates.length > 0 && (
        <ul className="found-list">
          {candidates.map((c, i) => (
            <li key={i} className={`found ${c.take ? "" : "is-off"}`}>
              <input type="checkbox" checked={c.take} onChange={(e) => edit(i, { take: e.target.checked })} aria-label="übernehmen" />
              <span className="found-when">
                {fmtShortDay(c.start)}
                {!c.allDay && `, ${fmtTime(c.start)}`}
              </span>
              <input className="found-title" value={c.title} onChange={(e) => edit(i, { title: e.target.value })} />
              <select value={c.kind} onChange={(e) => edit(i, { kind: e.target.value as EventKind })}>
                {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input className="found-course" value={c.course} placeholder="Fach" list="course-list-text" onChange={(e) => edit(i, { course: e.target.value })} />
            </li>
          ))}
        </ul>
      )}
      <datalist id="course-list-text">
        {courses.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={save} disabled={!candidates.some((c) => c.take)}>
          {candidates.filter((c) => c.take).length} Termine übernehmen
        </button>
        <button className="btn btn-quiet" onClick={onDone}>
          Abbrechen
        </button>
      </div>
    </section>
  );
}

// ---------- Kalender-Abos ----------

function Feeds({ p }: { p: ReturnType<typeof usePlanner> }) {
  const [name, setName] = useState("ADAM");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!url.trim()) return;
    setBusy(true);
    // Stundenplan-Abo der Uni: daraus werden Stundenplan und Prüfungen gebaut (feste ID, damit es nur eines gibt)
    const feed: Feed = isTimetableUrl(url)
      ? { id: TIMETABLE_FEED_ID, name: TIMETABLE_FEED_NAME, url: url.trim(), role: "timetable", createdAt: Date.now() }
      : { id: crypto.randomUUID(), name: name.trim() || "Kalender", url: url.trim(), createdAt: Date.now() };
    await putItem("feeds", feed);
    await fetchFeed(feed);
    await refreshFeeds(false);
    p.reload();
    setUrl("");
    setBusy(false);
  }

  return (
    <section className="sheet panel editor-panel">
      <h2 className="panel-title">Kalender abonnieren</h2>
      <div className="help-cols">
        <div>
          <h3>ADAM</h3>
          <p className="small muted">
            In ADAM oben rechts auf dein Profil → <strong>Kalender</strong>. Dort über das Zahnrad- bzw. Aktionen-Menü{" "}
            <strong>„Kalender abonnieren“</strong> wählen und die angezeigte Adresse kopieren. Sie enthält einen persönlichen
            Schlüssel, damit Jarvis die Termine ohne dein Passwort lesen kann.
          </p>
        </div>
        <div>
          <h3>Outlook (Uni-Mail)</h3>
          <p className="small muted">
            In Outlook im Web: Einstellungen → Kalender → <strong>Freigegebene Kalender</strong> → „Kalender
            veröffentlichen“, Kalender wählen, „Alle Details“ und auf Veröffentlichen klicken. Den <strong>ICS-Link</strong>{" "}
            kopieren. Termine, die Jarvis aus deinen Mails einträgt, erscheinen so auch hier.
          </p>
        </div>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field span-2">
          <span>Abo-Adresse (https:// oder webcal://)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://adam.unibas.ch/calendar.php?…" />
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={add} disabled={busy || !url.trim()}>
          {busy ? "Lade …" : "Abonnieren"}
        </button>
      </div>

      {p.data.feeds.length > 0 && (
        <ul className="feed-list">
          {p.data.feeds.map((f) => {
            const c = p.data.caches.find((c) => c.id === f.id);
            return (
              <li key={f.id} className="feed">
                <div>
                  <strong>{f.name}</strong>
                  {f.role === "timetable" && <span className="small muted"> · füllt Stundenplan und Prüfungen</span>}
                  <div className="small muted">
                    {c?.error ? (
                      <span className="text-red">{c.error}</span>
                    ) : c ? (
                      `${c.events.length} Termine · aktualisiert ${fmtTime(c.fetchedAt)}`
                    ) : (
                      "noch nicht geladen"
                    )}
                  </div>
                </div>
                <div className="row">
                  <button
                    className="btn btn-quiet"
                    onClick={async () => {
                      await fetchFeed(f);
                      p.reload();
                    }}
                  >
                    Neu laden
                  </button>
                  <button
                    className="btn btn-quiet"
                    onClick={async () => {
                      if (!confirm(`Abo „${f.name}“ entfernen?`)) return;
                      await deleteItems("feeds", [f.id]);
                      await deleteFeedCache(f.id);
                    }}
                  >
                    Entfernen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
