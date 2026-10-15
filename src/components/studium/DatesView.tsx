"use client";

import { addDays, DAYMS, dayStart, fmtShortDay, parseIsoDate, relDay } from "@/lib/planner";
import { LECTURE_FREE, SEMESTERS, UNI_DEADLINES } from "@/lib/uniDates";

const iso = (s: string) => parseIsoDate(s);

/** Aktuelles (oder nächstes) Semester mit Fortschritt der Vorlesungszeit. */
function semesterState(now: number) {
  const today = dayStart(now);
  const sem = SEMESTERS.find((s) => today >= iso(s.from) && today <= iso(s.until)) ?? SEMESTERS.find((s) => iso(s.from) > today);
  if (!sem) return null;
  const from = iso(sem.lecturesFrom);
  const until = iso(sem.lecturesUntil);
  const weeks = Math.ceil((until - from + DAYMS) / (7 * DAYMS));
  const phase: "vor" | "während" | "nach" = today < from ? "vor" : today > until ? "nach" : "während";
  const week = phase === "während" ? Math.floor((today - from) / (7 * DAYMS)) + 1 : phase === "nach" ? weeks : 0;
  return { sem, weeks, week, phase, pct: Math.round((week / weeks) * 100) };
}

export function upcomingDeadlines(now: number, days = 180) {
  const today = dayStart(now);
  return UNI_DEADLINES.filter((d) => iso(d.date) >= today && iso(d.date) <= addDays(today, days)).sort((a, b) => a.date.localeCompare(b.date));
}

export function SemesterCard({ now }: { now: number }) {
  const st = semesterState(now);
  if (!st) return null;
  return (
    <section className="sheet panel st-semester">
      <h2 className="panel-title">{st.sem.name}</h2>
      <p className="small muted" style={{ margin: 0 }}>
        Vorlesungen {fmtShortDay(iso(st.sem.lecturesFrom))} – {fmtShortDay(iso(st.sem.lecturesUntil))}
      </p>
      {st.phase === "während" ? (
        <>
          <div className="bar" aria-label={`Woche ${st.week} von ${st.weeks}`}>
            <span style={{ width: `${st.pct}%` }} />
          </div>
          <p className="small" style={{ margin: 0 }}>
            Vorlesungswoche <strong>{st.week}</strong> von {st.weeks}
          </p>
        </>
      ) : (
        <p className="small" style={{ margin: 0 }}>
          {st.phase === "vor"
            ? `Vorlesungsbeginn ${relDay(iso(st.sem.lecturesFrom), now)}`
            : "Vorlesungszeit vorbei – jetzt ist Prüfungszeit bzw. vorlesungsfrei."}
        </p>
      )}
    </section>
  );
}

export function DatesView({ now }: { now: number }) {
  const today = dayStart(now);
  const deadlines = UNI_DEADLINES.filter((d) => iso(d.date) >= addDays(today, -14)).sort((a, b) => a.date.localeCompare(b.date));
  const free = LECTURE_FREE.filter((f) => iso(f.until) >= today);

  return (
    <div className="st-dates">
      <SemesterCard now={now} />

      <section className="sheet panel">
        <h2 className="panel-title">Fristen der Uni</h2>
        <ul className="st-deadlines">
          {deadlines.map((d) => {
            const due = iso(d.date);
            const past = due < today;
            const running = d.from && iso(d.from) <= today && !past;
            return (
              <li key={d.id} className={past ? "is-past" : ""}>
                <div className="st-deadline-when">
                  <strong>{fmtShortDay(due)}</strong>
                  <span className="small muted">{past ? "vorbei" : relDay(due, now)}</span>
                </div>
                <div>
                  <div className="st-deadline-title">
                    {d.title}
                    {d.estimated && <span className="pill st-pill-est">geschätzt</span>}
                    {running && <span className="pill st-pill-open">läuft</span>}
                  </div>
                  {d.from && (
                    <div className="small muted">
                      Zeitraum {fmtShortDay(iso(d.from))} – {fmtShortDay(due)}
                    </div>
                  )}
                  <p className="small muted" style={{ margin: "4px 0" }}>
                    {d.note}
                  </p>
                  <a className="small" href={d.link} target="_blank" rel="noreferrer">
                    Offizielle Seite
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="small muted" style={{ marginBottom: 0 }}>
          „Geschätzt“ heisst: Die Uni hat das Datum noch nicht veröffentlicht; Jarvis rechnet mit den Vorjahren. Prüfe es auf der
          offiziellen Seite, sobald es dort steht.
        </p>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">Vorlesungsfrei</h2>
        <ul className="st-free">
          {free.map((f) => (
            <li key={f.from}>
              <span>{f.from === f.until ? fmtShortDay(iso(f.from)) : `${fmtShortDay(iso(f.from))} – ${fmtShortDay(iso(f.until))}`}</span>
              <span className="muted">{f.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">Semesterdaten</h2>
        <ul className="st-free">
          {SEMESTERS.map((s) => (
            <li key={s.id}>
              <span>{s.name}</span>
              <span className="muted">
                Vorlesungen {fmtShortDay(iso(s.lecturesFrom))} – {fmtShortDay(iso(s.lecturesUntil))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
