// Fokus-Timer (Pomodoro) und Lernzeit-Auswertung.
// Der Timer speichert nur Startzeit und Pausen; die Restzeit wird immer aus der Uhr berechnet.
// So übersteht er Neuladen, Tabwechsel und ein schlafendes Handy.

import type { StudySession } from "./assistant";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export type TimerState = {
  phase: "focus" | "break";
  course: string;
  minutes: number; // geplante Dauer dieser Phase
  breakMinutes: number; // Pause nach der Fokus-Phase
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number; // Summe der bisherigen Pausen
};

export type FocusSettings = { focus: number; brk: number; goal: number };
export const DEFAULT_SETTINGS: FocusSettings = { focus: 25, brk: 5, goal: 120 };

const TIMER_KEY = "fokus-timer";
const SETTINGS_KEY = "fokus-einstellungen";

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ohne Speicher läuft der Timer trotzdem, übersteht aber kein Neuladen
  }
}

export const loadTimer = () => read<TimerState>(TIMER_KEY);
export const saveTimer = (s: TimerState | null) => write(TIMER_KEY, s);
export const loadSettings = (): FocusSettings => ({ ...DEFAULT_SETTINGS, ...(read<Partial<FocusSettings>>(SETTINGS_KEY) ?? {}) });
export const saveSettings = (s: FocusSettings) => write(SETTINGS_KEY, s);

/** Wie lange die Phase schon läuft (ohne Pausen). */
export function elapsedMs(s: TimerState, now = Date.now()) {
  return Math.max(0, (s.pausedAt ?? now) - s.startedAt - s.pausedMs);
}

export function remainingMs(s: TimerState, now = Date.now()) {
  return s.minutes * MIN - elapsedMs(s, now);
}

/** Zeitpunkt, an dem die Phase endet bzw. endete (nur sinnvoll, wenn nicht pausiert). */
export function phaseEnd(s: TimerState) {
  return s.startedAt + s.pausedMs + s.minutes * MIN;
}

export function fmtClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Feste ID pro Fokus-Phase: Mehrere offene Tabs speichern so dieselbe Einheit nur einmal. */
export const sessionIdFor = (s: TimerState) => `fokus-${s.startedAt}`;

// ---------- Auswertung ----------

export function dayStart(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Montag 00:00 der Woche von t. */
export function weekStart(t: number) {
  const d = new Date(dayStart(t));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export type CourseMinutes = { course: string; minutes: number };

function byCourse(list: StudySession[]): CourseMinutes[] {
  const m = new Map<string, number>();
  for (const s of list) {
    const c = s.course || "Allgemein";
    m.set(c, (m.get(c) ?? 0) + s.minutes);
  }
  return [...m.entries()].map(([course, minutes]) => ({ course, minutes })).sort((a, b) => b.minutes - a.minutes);
}

export function focusStats(sessions: StudySession[], now = Date.now()) {
  const today0 = dayStart(now);
  const week0 = weekStart(now);
  const fourWeeks0 = weekStart(now) - 3 * 7 * DAY;
  const sum = (l: StudySession[]) => l.reduce((n, s) => n + s.minutes, 0);

  const today = sessions.filter((s) => s.start >= today0);
  const week = sessions.filter((s) => s.start >= week0);
  const four = sessions.filter((s) => s.start >= fourWeeks0);

  // Serie: aufeinanderfolgende Tage mit Lernzeit, bis heute bzw. gestern
  const days = new Set(sessions.map((s) => dayStart(s.start)));
  let streak = 0;
  const step = (d: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() - 1);
    return x.getTime();
  };
  for (let d = days.has(today0) ? today0 : step(today0); days.has(d); d = step(d)) streak++;

  // Minuten pro Tag dieser Woche (Mo–So)
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const from = new Date(week0);
    from.setDate(from.getDate() + i);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return sum(sessions.filter((s) => s.start >= from.getTime() && s.start < to.getTime()));
  });

  return {
    todayMinutes: sum(today),
    weekMinutes: sum(week),
    fourWeekMinutes: sum(four),
    week: byCourse(week),
    fourWeeks: byCourse(four),
    perDay,
    streak,
  };
}

export function fmtMinutes(min: number) {
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}
