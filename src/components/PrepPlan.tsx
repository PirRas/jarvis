"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deleteItems, putItems } from "@/lib/db";
import { fmtDay, fmtShortDay, fmtTime, relDay, type Occurrence } from "@/lib/planner";
import {
  alternatives,
  doneId,
  pinId,
  pinMark,
  postponed,
  prepSettingsMark,
  readSeen,
  seenMark,
  snapshot,
  validWindow,
  type Moved,
  type PrepSettings,
} from "@/lib/prepPlan";
import type { usePlanner } from "@/lib/usePlanner";

type P = ReturnType<typeof usePlanner>;

const same = (a: Record<string, number> | null, b: Record<string, number>) =>
  !!a && Object.keys(a).length === Object.keys(b).length && Object.entries(b).every(([k, v]) => a[k] === v);

/**
 * Was Jarvis nach hinten verschoben hat (Termin dazwischen, Einheit verpasst). Ohne solche Verschiebungen
 * merkt sich Jarvis den aktuellen Plan still als "gesehen".
 */
export function usePrepMoves(p: P): Moved[] {
  const prev = readSeen(p.marks);
  const moved = useMemo(() => (p.loaded ? postponed(prev, p.prep, p.data, p.now) : []), [p.loaded, prev, p.prep, p.data, p.now]);
  const snap = useMemo(() => snapshot(p.prep, p.now), [p.prep, p.now]);
  useEffect(() => {
    if (!p.loaded || moved.length || same(prev, snap)) return;
    void putItems("marks", [seenMark(p.prep)]);
  }, [p.loaded, moved.length, prev, snap, p.prep]);
  return moved;
}

export const markDone = (lessonKey: string) => putItems("marks", [{ id: doneId(lessonKey), createdAt: Date.now() }]);
const pin = (lessonKey: string, start: number) => putItems("marks", [pinMark(lessonKey, start)]);
const ack = (p: P) => putItems("marks", [seenMark(p.prep)]);

const lessonLabel = (o: Occurrence) => `${o.course}, Vorlesung vom ${fmtShortDay(o.start)}`;
const when = (t: number) => `${fmtShortDay(t)}, ${fmtTime(t)}`;

/** Hinweis auf verschobene Einheiten, mit Vorschlägen für eine andere Zeit. */
export function PrepMoves({ p, compact = false }: { p: P; compact?: boolean }) {
  const moved = usePrepMoves(p);
  if (!moved.length) return null;
  if (compact)
    return (
      <p className="tip tone-urgent prep-moved-tip">
        <span>
          Jarvis hat {moved.length === 1 ? "eine Nachbereitung" : `${moved.length} Nachbereitungen`} verschoben.{" "}
          <Link href="/lernplan#nachbereitung">Ansehen</Link>
        </span>
      </p>
    );
  return (
    <div className="prep-moved" role="status">
      <h3 className="panel-sub">Verschoben</h3>
      <ul className="lp-pending">
        {moved.map((m) => (
          <MovedRow key={m.lesson.key} p={p} m={m} />
        ))}
      </ul>
      <button className="btn btn-quiet small" onClick={() => ack(p)}>
        Passt so
      </button>
    </div>
  );
}

function MovedRow({ p, m }: { p: P; m: Moved }) {
  const alts = alternatives(p.data, p.prep, m.lesson, p.now);
  return (
    <li>
      <div>
        <strong>{lessonLabel(m.lesson)}</strong>
        <div className="small muted">
          {when(m.from)} {m.cause} → {m.session ? <strong>{when(m.session.start)}</strong> : "noch kein freier Platz"}
        </div>
      </div>
      {alts.length > 0 && (
        <div className="row">
          <span className="small muted">Lieber:</span>
          {alts.map((t) => (
            <button key={t} className="btn small" onClick={async () => (await pin(m.lesson.key, t), await ack(p))}>
              {when(t)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

/** Ganzer Nachbereitungsplan für die Lernplan-Seite. */
export function PrepPlanPanel({ p }: { p: P }) {
  const { prep } = p;
  const [settings, setSettings] = useState(false);
  const [other, setOther] = useState<string | null>(null);
  const upcoming = prep.sessions.filter((x) => x.start < p.now + 7 * 86_400_000);
  const week = upcoming.slice(0, 8);
  const total = prep.weeks.reduce((s, w) => s + w.lessons.length, 0);
  const doneCount = prep.weeks.reduce((s, w) => s + w.lessons.filter((l) => l.done).length, 0);
  const marked = new Set(p.marks.map((m) => m.id));

  return (
    <section id="nachbereitung" className="sheet panel" style={{ marginTop: 32 }}>
      <div className="row spread">
        <h2 className="panel-title">Nachbereitungsplan</h2>
        <button className="btn btn-quiet small" onClick={() => setSettings((s) => !s)} aria-expanded={settings}>
          Lernzeiten
        </button>
      </div>
      <p className="small muted" style={{ margin: "4px 0 12px" }}>
        Jede Vorlesung seit {fmtShortDay(prep.since)} bekommt eine Einheit in deiner freien Zeit. Trägst du einen Termin
        ein oder sagst Jarvis, dass du keine Zeit hast, rutscht die Einheit automatisch auf den nächsten freien Platz.
      </p>
      {settings && <PrepSettingsForm value={prep.settings} onDone={() => setSettings(false)} />}

      <div className="lp-stats">
        <div>
          <strong>{prep.backlog.length}</strong>
          <span className="small muted">Vorlesungen offen</span>
        </div>
        <div>
          <strong>
            {doneCount}/{total}
          </strong>
          <span className="small muted">seit Semesterbeginn nachbereitet</span>
        </div>
        <div>
          <strong>{prep.catchUp ? fmtShortDay(prep.catchUp) : prep.backlog.length ? "–" : "✓"}</strong>
          <span className="small muted">{prep.backlog.length ? "Rückstand aufgeholt" : "kein Rückstand"}</span>
        </div>
      </div>
      {!prep.settings.on && <p className="small muted">Der Plan ist ausgeschaltet (Lernzeiten).</p>}
      {prep.settings.on && prep.unplanned.some((o) => o.end <= p.now) && (
        <p className="small text-red">
          {prep.unplanned.filter((o) => o.end <= p.now).length} Vorlesungen finden in den nächsten Monaten keinen Platz. Mehr
          Lernzeit pro Tag einstellen?
        </p>
      )}

      <PrepMoves p={p} />

      <h3 className="panel-sub">Nächste 7 Tage</h3>
      {week.length === 0 ? (
        <p className="muted small">Keine Einheiten geplant.</p>
      ) : (
        <ul className="lp-pending">
          {week.map((x) => (
            <li key={x.key}>
              <div>
                <strong>{lessonLabel(x.lesson)}</strong>
                <div className="small muted">
                  {fmtDay(x.start)}, {fmtTime(x.start)}–{fmtTime(x.end)} · {relDay(x.start, p.now)}
                  {x.pinned && " · fest"}
                </div>
                {other === x.key && <OtherTime p={p} lesson={x.lesson} onDone={() => setOther(null)} />}
              </div>
              <div className="row">
                <button className="btn btn-primary small" onClick={() => markDone(x.lesson.key)}>
                  Erledigt
                </button>
                <button className="btn btn-quiet small" onClick={() => setOther(other === x.key ? null : x.key)}>
                  Andere Zeit
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {upcoming.length > week.length && (
        <p className="small muted">
          Und {upcoming.length - week.length} weitere Einheiten im <Link href="/kalender">Kalender</Link>.
        </p>
      )}

      <h3 className="panel-sub">Abhaken nach Woche</h3>
      {prep.weeks.length === 0 ? (
        <p className="muted small">Noch keine Vorlesungen im Stundenplan.</p>
      ) : (
        <div className="prep-weeks">
          {[...prep.weeks].reverse().map((w) => {
            const n = w.lessons.filter((l) => l.done).length;
            return (
              <details key={w.start} className="prep-week" open={n < w.lessons.length && w === prep.weeks.find((x) => x.lessons.some((l) => !l.done))}>
                <summary>
                  Woche ab {fmtShortDay(w.start)}{" "}
                  <span className={n === w.lessons.length ? "pill" : "small muted"}>
                    {n}/{w.lessons.length}
                  </span>
                </summary>
                <ul className="prep-checks">
                  {w.lessons.map(({ o, done }) => {
                    const byMark = marked.has(doneId(o.key));
                    return (
                      <li key={o.key}>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={done}
                            disabled={done && !byMark}
                            title={done && !byMark ? "Durch eine gespeicherte Nachbereitung abgedeckt" : undefined}
                            onChange={() => (byMark ? deleteItems("marks", [doneId(o.key)]) : markDone(o.key))}
                          />
                          {o.course} <span className="small muted">{fmtShortDay(o.start)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>
        Folien hochladen unter <Link href="/vorlesungen">Vorlesungen</Link>: Jarvis erstellt Notizen und Karten, und die
        Vorlesung gilt als nachbereitet.
      </p>
    </section>
  );
}

function OtherTime({ p, lesson, onDone }: { p: P; lesson: Occurrence; onDone: () => void }) {
  const alts = alternatives(p.data, p.prep, lesson, p.now, 4);
  const pinned = p.marks.some((m) => m.id === pinId(lesson.key));
  return (
    <div className="row" style={{ marginTop: 8 }}>
      {alts.length ? (
        alts.map((t) => (
          <button key={t} className="btn small" onClick={async () => (await pin(lesson.key, t), onDone())}>
            {when(t)}
          </button>
        ))
      ) : (
        <span className="small muted">In den nächsten drei Wochen ist nichts mehr frei.</span>
      )}
      {pinned && (
        <button className="btn btn-quiet small" onClick={async () => (await deleteItems("marks", [pinId(lesson.key)]), onDone())}>
          Jarvis entscheiden lassen
        </button>
      )}
    </div>
  );
}

function PrepSettingsForm({ value, onDone }: { value: PrepSettings; onDone: () => void }) {
  const [s, setS] = useState(value);
  const ok = validWindow(s.weekday.from, s.weekday.to) && (!s.weekend.on || validWindow(s.weekend.from, s.weekend.to));
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));
  return (
    <div className="prep-settings">
      <label className="check">
        <input type="checkbox" checked={s.on} onChange={(e) => setS({ ...s, on: e.target.checked })} /> Nachbereitung automatisch planen
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Dauer pro Vorlesung (Min.)</span>
          <input type="number" min={20} max={180} step={5} value={s.minutes} onChange={(e) => setS({ ...s, minutes: num(e.target.value, 20, 180) })} />
        </label>
        <label className="field">
          <span>Werktags ab</span>
          <input type="time" value={s.weekday.from} onChange={(e) => setS({ ...s, weekday: { ...s.weekday, from: e.target.value } })} />
        </label>
        <label className="field">
          <span>Werktags bis</span>
          <input type="time" value={s.weekday.to} onChange={(e) => setS({ ...s, weekday: { ...s.weekday, to: e.target.value } })} />
        </label>
        <label className="field">
          <span>Werktags höchstens (Min.)</span>
          <input type="number" min={0} max={720} step={15} value={s.weekday.max} onChange={(e) => setS({ ...s, weekday: { ...s.weekday, max: num(e.target.value, 0, 720) } })} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={s.weekend.on} onChange={(e) => setS({ ...s, weekend: { ...s.weekend, on: e.target.checked } })} /> Auch am Wochenende
      </label>
      {s.weekend.on && (
        <div className="form-grid">
          <label className="field">
            <span>Wochenende ab</span>
            <input type="time" value={s.weekend.from} onChange={(e) => setS({ ...s, weekend: { ...s.weekend, from: e.target.value } })} />
          </label>
          <label className="field">
            <span>Wochenende bis</span>
            <input type="time" value={s.weekend.to} onChange={(e) => setS({ ...s, weekend: { ...s.weekend, to: e.target.value } })} />
          </label>
          <label className="field">
            <span>Pro Tag höchstens (Min.)</span>
            <input type="number" min={0} max={720} step={15} value={s.weekend.max} onChange={(e) => setS({ ...s, weekend: { ...s.weekend, max: num(e.target.value, 0, 720) } })} />
          </label>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" disabled={!ok} onClick={async () => (await putItems("marks", [prepSettingsMark(s)]), onDone())}>
          Speichern
        </button>
        <button className="btn btn-quiet" onClick={onDone}>
          Abbrechen
        </button>
        {!ok && <span className="small text-red">Das Ende muss nach dem Beginn liegen.</span>}
      </div>
    </div>
  );
}
