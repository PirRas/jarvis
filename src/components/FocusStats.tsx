"use client";

import { useCallback, useEffect, useState } from "react";
import "@/app/fokus/fokus.css";
import type { StudySession } from "@/lib/assistant";
import { listItems, onLocalChange } from "@/lib/db";
import { fmtMinutes, focusStats, loadSettings, saveSettings, type CourseMinutes } from "@/lib/focus";
import { REMOTE_CHANGE_EVENT } from "@/lib/sync";

/** Alle Lerneinheiten, aktuell gehalten bei eigenen Änderungen und beim Abgleich. */
export function useSessions() {
  const [sessions, setSessions] = useState<StudySession[] | null>(null);
  const load = useCallback(async () => {
    const all = await listItems("sessions");
    setSessions(all.sort((a, b) => b.start - a.start));
  }, []);
  useEffect(() => {
    load();
    const off = onLocalChange(load);
    window.addEventListener(REMOTE_CHANGE_EVENT, load);
    return () => {
      off();
      window.removeEventListener(REMOTE_CHANGE_EVENT, load);
    };
  }, [load]);
  return sessions;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function CourseBars({ list }: { list: CourseMinutes[] }) {
  const max = Math.max(1, ...list.map((c) => c.minutes));
  if (!list.length) return <p className="muted small">Noch keine Lernzeit.</p>;
  return (
    <ul className="fx-bars">
      {list.map((c) => (
        <li key={c.course}>
          <div className="fx-bar-label">
            <span>{c.course}</span>
            <strong>{fmtMinutes(c.minutes)}</strong>
          </div>
          <div className="bar">
            <span style={{ width: `${(c.minutes / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Lernzeit: Tagesziel, Serie, Woche pro Tag und pro Fach, letzte 4 Wochen. */
export function FocusStats({ sessions: given }: { sessions?: StudySession[] | null }) {
  const own = useSessions();
  const sessions = given ?? own;
  const [goal, setGoal] = useState(120);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setGoal(loadSettings().goal);
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!sessions) return <p className="muted">Lade …</p>;
  const st = focusStats(sessions, now);
  const pct = Math.min(100, Math.round((st.todayMinutes / Math.max(1, goal)) * 100));
  const maxDay = Math.max(1, ...st.perDay);
  const todayIdx = (new Date(now).getDay() + 6) % 7;

  return (
    <div className="fx-stats">
      <div className="stats-grid">
        <section className="sheet stat-panel">
          <h2>Heute gelernt</h2>
          <div className="big-number">{fmtMinutes(st.todayMinutes)}</div>
          <div className="bar fx-goal-bar" aria-label={`${pct} % des Tagesziels`}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <label className="fx-goal small muted">
            Tagesziel
            <input
              type="number"
              min={10}
              max={720}
              step={10}
              value={goal}
              onChange={(e) => {
                const v = Math.max(10, Math.min(720, Number(e.target.value) || 120));
                setGoal(v);
                saveSettings({ ...loadSettings(), goal: v });
              }}
            />
            Min. · {pct >= 100 ? "erreicht" : `${pct} %`}
          </label>
        </section>
        <section className="sheet stat-panel">
          <h2>Serie</h2>
          <div className="big-number">{st.streak}</div>
          <p className="muted" style={{ marginBottom: 0 }}>
            {st.streak === 1 ? "Tag" : "Tage"} in Folge mit Lernzeit
          </p>
        </section>
        <section className="sheet stat-panel">
          <h2>Diese Woche</h2>
          <div className="big-number">{fmtMinutes(st.weekMinutes)}</div>
          <div className="fx-week" role="img" aria-label={`Minuten pro Tag: ${st.perDay.join(", ")}`}>
            {st.perDay.map((m, i) => (
              <div key={i} className={`fx-week-col ${i === todayIdx ? "is-today" : ""}`} title={fmtMinutes(m)}>
                <div className="fx-week-bar" style={{ height: `${(m / maxDay) * 48}px` }} />
                <span>{WEEKDAYS[i]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fx-two">
        <section className="sheet stat-panel">
          <h2>Pro Fach diese Woche</h2>
          <CourseBars list={st.week} />
        </section>
        <section className="sheet stat-panel">
          <h2>Pro Fach, letzte 4 Wochen</h2>
          <CourseBars list={st.fourWeeks} />
          {st.fourWeekMinutes > 0 && (
            <p className="muted small" style={{ marginBottom: 0 }}>
              Zusammen {fmtMinutes(st.fourWeekMinutes)}, im Schnitt {fmtMinutes(Math.round(st.fourWeekMinutes / 4))} pro Woche.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
