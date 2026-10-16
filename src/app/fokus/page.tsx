"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FocusStats, useSessions } from "@/components/FocusStats";
import type { StudySession } from "@/lib/assistant";
import { deleteItems, putItem } from "@/lib/db";
import {
  elapsedMs,
  fmtClock,
  fmtMinutes,
  loadSettings,
  loadTimer,
  phaseEnd,
  remainingMs,
  saveSettings,
  saveTimer,
  sessionIdFor,
  type FocusSettings,
  type TimerState,
} from "@/lib/focus";
import { knownCourses } from "@/lib/planner";
import { usePlanner } from "@/lib/usePlanner";
import "./fokus.css";

const MIN = 60_000;
const COURSE_KEY = "fokus-fach";
const FOCUS_CHOICES = [25, 50];
const BREAK_CHOICES = [5, 10, 15];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Drei kurze Pieptöne über WebAudio. */
function beep(ctx: AudioContext | null) {
  if (!ctx) return;
  ctx.resume().catch(() => undefined);
  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * 0.28;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}

async function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    // Über den Service Worker klappt es auch auf Android; sonst direkt.
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) await reg.showNotification(title, { body, icon: "/icon-192.png", tag: "fokus" });
    else new Notification(title, { body, icon: "/icon-192.png", tag: "fokus" });
  } catch {
    // Benachrichtigung ist nur ein Zusatz; der Ton und die Anzeige reichen.
  }
}

async function saveSession(t: TimerState, minutes: number, kind: StudySession["kind"] = "pomodoro") {
  if (minutes < 1) return;
  await putItem("sessions", {
    id: sessionIdFor(t),
    course: t.course,
    start: t.startedAt,
    minutes,
    kind,
    createdAt: Date.now(),
  });
}

export default function FocusPage() {
  const p = usePlanner();
  const sessions = useSessions();
  const courses = useMemo(
    () => knownCourses(p.data, p.lectures.map((l) => l.course)),
    [p.data, p.lectures],
  );

  const [timer, setTimer] = useState<TimerState | null>(null);
  const [settings, setSettings] = useState<FocusSettings | null>(null);
  const [course, setCourse] = useState("");
  const [custom, setCustom] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const audio = useRef<AudioContext | null>(null);
  const handled = useRef<string | null>(null);

  const update = useCallback((t: TimerState | null) => {
    setTimer(t);
    saveTimer(t);
  }, []);

  // Zustand laden; andere Tabs halten den Timer synchron
  useEffect(() => {
    setTimer(loadTimer());
    setSettings(loadSettings());
    try {
      setCourse(localStorage.getItem(COURSE_KEY) ?? "");
    } catch {
      // ohne Speicher eben ohne Vorbelegung
    }
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    const onStorage = (e: StorageEvent) => e.key === "fokus-timer" && setTimer(loadTimer());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Uhr: jede Sekunde, solange ein Timer läuft, und beim Zurückkehren in den Tab
  useEffect(() => {
    if (!timer || timer.pausedAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [timer]);

  // Restzeit im Tab-Titel
  useEffect(() => {
    const original = "Jarvis";
    if (!timer) {
      document.title = original;
      return;
    }
    const label = timer.phase === "focus" ? "Fokus" : "Pause";
    document.title = `${fmtClock(remainingMs(timer, now))} ${timer.pausedAt ? "(pausiert) " : ""}· ${label} · Jarvis`;
    return () => {
      document.title = original;
    };
  }, [timer, now]);

  // Ablauf einer Phase (auch wenn er passiert ist, während die App zu war)
  useEffect(() => {
    if (!timer || timer.pausedAt || remainingMs(timer, now) > 0) return;
    const key = `${timer.phase}:${timer.startedAt}`;
    if (handled.current === key) return;
    handled.current = key;

    const end = phaseEnd(timer);
    const fresh = Date.now() - end < 90_000; // nur melden, wenn es gerade eben passiert ist
    if (timer.phase === "focus") {
      saveSession(timer, timer.minutes);
      if (fresh) {
        beep(audio.current);
        notify("Fokus-Einheit fertig", timer.breakMinutes ? `${timer.minutes} Min. ${timer.course || "gelernt"}. Jetzt ${timer.breakMinutes} Min. Pause.` : `${timer.minutes} Min. gelernt.`);
      }
      setMessage(`${fmtMinutes(timer.minutes)} ${timer.course ? `für ${timer.course} ` : ""}gespeichert.`);
      const brk: TimerState = { ...timer, phase: "break", minutes: timer.breakMinutes, startedAt: end, pausedAt: null, pausedMs: 0 };
      update(timer.breakMinutes > 0 && remainingMs(brk) > 0 ? brk : null);
    } else {
      if (fresh) {
        beep(audio.current);
        notify("Pause vorbei", "Bereit für die nächste Runde?");
      }
      update(null);
    }
  }, [timer, now, update]);

  if (!settings) return <p className="muted">Lade …</p>;

  const focusMin = Number(custom) > 0 ? Math.min(180, Math.max(1, Math.round(Number(custom)))) : settings.focus;

  function start() {
    // Ton erst nach einem Klick möglich (Browser-Regel), deshalb hier vorbereiten
    try {
      audio.current ??= new AudioContext();
      audio.current.resume().catch(() => undefined);
    } catch {
      audio.current = null;
    }
    const s = { ...settings!, focus: focusMin };
    setSettings(s);
    saveSettings(s);
    try {
      localStorage.setItem(COURSE_KEY, course.trim());
    } catch {
      // egal
    }
    setMessage(null);
    update({ phase: "focus", course: course.trim(), minutes: focusMin, breakMinutes: s.brk, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
  }

  function pause() {
    if (timer && !timer.pausedAt) update({ ...timer, pausedAt: Date.now() });
  }

  function resume() {
    if (timer?.pausedAt) update({ ...timer, pausedMs: timer.pausedMs + (Date.now() - timer.pausedAt), pausedAt: null });
  }

  async function finishEarly() {
    if (!timer) return;
    const minutes = Math.round(elapsedMs(timer) / MIN);
    await saveSession(timer, minutes);
    setMessage(minutes >= 1 ? `${fmtMinutes(minutes)} gespeichert.` : "Unter einer Minute, nichts gespeichert.");
    const end = Date.now();
    update(timer.breakMinutes > 0 ? { ...timer, phase: "break", minutes: timer.breakMinutes, startedAt: end, pausedAt: null, pausedMs: 0 } : null);
  }

  async function cancel() {
    if (!timer) return;
    if (timer.phase === "focus") {
      const minutes = Math.round(elapsedMs(timer) / MIN);
      if (minutes >= 5 && confirm(`Die bisherigen ${minutes} Minuten als Lernzeit speichern?`)) {
        await saveSession(timer, minutes);
        setMessage(`${fmtMinutes(minutes)} gespeichert.`);
      }
    }
    update(null);
  }

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  }

  const rem = timer ? remainingMs(timer, now) : 0;
  const pct = timer ? Math.min(100, Math.max(0, (1 - rem / (timer.minutes * MIN)) * 100)) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Fokus</h1>
          <p className="lede">
            Konzentriert lernen in festen Runden, danach kurz Pause. Jede Runde wird als Lernzeit beim Fach gespeichert und
            erscheint in der Statistik.
          </p>
        </div>
      </div>

      <section className={`sheet panel fx-timer ${timer ? `is-${timer.phase}` : ""}`}>
        {timer ? (
          <>
            <p className="fx-phase">
              {timer.phase === "focus" ? "Fokus" : "Pause"}
              {timer.course && timer.phase === "focus" && <span className="muted"> · {timer.course}</span>}
              {timer.pausedAt && <span className="muted"> · pausiert</span>}
            </p>
            <div className="fx-clock" aria-live="off">
              {fmtClock(rem)}
            </div>
            <div className="bar fx-progress">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="row fx-actions">
              {timer.pausedAt ? (
                <button className="btn btn-primary" onClick={resume}>
                  Weiter
                </button>
              ) : (
                <button className="btn" onClick={pause}>
                  Pause
                </button>
              )}
              {timer.phase === "focus" ? (
                <>
                  <button className="btn" onClick={finishEarly}>
                    Fertig
                  </button>
                  <button className="btn btn-quiet" onClick={cancel}>
                    Abbrechen
                  </button>
                </>
              ) : (
                <button className="btn btn-quiet" onClick={() => update(null)}>
                  Pause überspringen
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="form-grid">
              <label className="field span-2">
                <span>Fach</span>
                <input
                  list="fx-courses"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="z. B. Einführung in die Chemie"
                />
                <datalist id="fx-courses">
                  {courses.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className="fx-choices">
              <span className="small muted">Dauer</span>
              {FOCUS_CHOICES.map((m) => (
                <button
                  key={m}
                  className={`fx-chip ${!custom && settings.focus === m ? "is-on" : ""}`}
                  onClick={() => {
                    setCustom("");
                    setSettings({ ...settings, focus: m });
                  }}
                >
                  {m} Min.
                </button>
              ))}
              <input
                className="fx-custom"
                type="number"
                min={1}
                max={180}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="eigene"
                aria-label="Eigene Dauer in Minuten"
              />
            </div>
            <div className="fx-choices">
              <span className="small muted">Pause</span>
              {BREAK_CHOICES.map((m) => (
                <button
                  key={m}
                  className={`fx-chip ${settings.brk === m ? "is-on" : ""}`}
                  onClick={() => setSettings({ ...settings, brk: m })}
                >
                  {m} Min.
                </button>
              ))}
              <button className={`fx-chip ${settings.brk === 0 ? "is-on" : ""}`} onClick={() => setSettings({ ...settings, brk: 0 })}>
                keine
              </button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn-primary" onClick={start}>
                {focusMin} Min. starten
              </button>
              {permission === "default" && (
                <button className="btn btn-quiet" onClick={askPermission}>
                  Benachrichtigung bei Ablauf erlauben
                </button>
              )}
              {permission === "denied" && (
                <span className="small muted">Benachrichtigungen sind im Browser blockiert; es gibt nur einen Ton.</span>
              )}
            </div>
          </>
        )}
        {message && (
          <p className="verdict-ok small" role="status" style={{ margin: 0 }}>
            {message}
          </p>
        )}
      </section>

      <h2 className="course-title fx-heading">Lernzeit</h2>
      <FocusStats sessions={sessions} />

      <div className="fx-two">
        <ManualEntry courses={courses} />
        <RecentSessions sessions={sessions} />
      </div>
    </>
  );
}

function ManualEntry({ courses }: { courses: string[] }) {
  const [course, setCourse] = useState("");
  const [date, setDate] = useState(todayIso);
  const [minutes, setMinutes] = useState("45");
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const m = Math.round(Number(minutes));
    if (!(m > 0) || m > 900) return;
    const [y, mo, d] = date.split("-").map(Number);
    const isToday = date === todayIso();
    // Heute: als gerade beendet eintragen, sonst mittags
    const start = isToday ? Date.now() - m * MIN : new Date(y, mo - 1, d, 12).getTime();
    await putItem("sessions", {
      id: crypto.randomUUID(),
      course: course.trim(),
      start,
      minutes: m,
      kind: "frei",
      createdAt: Date.now(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form className="sheet panel fx-manual" onSubmit={save}>
      <h2 className="panel-title">Lernzeit nachtragen</h2>
      <div className="form-grid">
        <label className="field span-2">
          <span>Fach</span>
          <input list="fx-courses-manual" value={course} onChange={(e) => setCourse(e.target.value)} />
          <datalist id="fx-courses-manual">
            {courses.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Datum</span>
          <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field">
          <span>Minuten</span>
          <input type="number" min={1} max={900} value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
        </label>
      </div>
      <div className="row">
        <button className="btn btn-primary" type="submit">
          Eintragen
        </button>
        {saved && (
          <span className="verdict-ok small" role="status">
            Eingetragen.
          </span>
        )}
      </div>
    </form>
  );
}

function RecentSessions({ sessions }: { sessions: StudySession[] | null }) {
  const recent = (sessions ?? []).slice(0, 15);
  return (
    <section className="sheet panel">
      <h2 className="panel-title">Letzte Einheiten</h2>
      {recent.length === 0 ? (
        <p className="muted small">Noch keine. Starte oben eine Fokus-Runde.</p>
      ) : (
        <ul className="fx-list">
          {recent.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{s.course || "Allgemein"}</strong>
                <div className="small muted">
                  {new Date(s.start).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
                  {s.kind === "pomodoro" ? `, ${new Date(s.start).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} · Fokus-Runde` : " · nachgetragen"}
                </div>
              </div>
              <div className="row">
                <span className="fx-min">{fmtMinutes(s.minutes)}</span>
                <button
                  className="btn btn-quiet small"
                  onClick={() => confirm("Diese Lerneinheit löschen?") && deleteItems("sessions", [s.id])}
                  aria-label="Löschen"
                >
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
