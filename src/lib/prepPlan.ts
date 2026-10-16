// Nachbereitungsplan: Jede Vorlesung seit Semesterbeginn, die noch nicht nachbereitet ist, bekommt eine
// Lerneinheit in einer freien Zeit (Nachmittage, Abende, Wochenende). Der Plan wird nicht gespeichert, sondern
// bei jeder Änderung neu gerechnet: Ein neuer Termin, ein "keine Zeit" oder eine verpasste Einheit verschiebt
// die betroffenen Einheiten automatisch. Fest gelegte Zeiten (Pins) und Einstellungen liegen als Markierungen
// im abgeglichenen Bereich, damit alle Geräte denselben Plan rechnen. Reine Funktionen, damit sie testbar sind.

import type { Mark } from "./assistant";
import { isLectureType, pendingSince, type LectureLite } from "./lernplan";
import {
  addDays,
  atTime,
  DAYMS,
  dayStart,
  fmtShortDay,
  isoDate,
  isoWeekday,
  MIN,
  occurrences,
  parseIsoDate,
  parseTime,
  type Occurrence,
  type PlannerData,
} from "./planner";

export type PrepSettings = {
  on: boolean;
  minutes: number; // Dauer einer Einheit (eine Vorlesung)
  weekday: { from: string; to: string; max: number }; // max = Minuten pro Tag
  weekend: { on: boolean; from: string; to: string; max: number };
};

export const DEFAULT_PREP: PrepSettings = {
  on: true,
  minutes: 60,
  weekday: { from: "13:00", to: "20:00", max: 180 },
  weekend: { on: true, from: "10:00", to: "17:00", max: 240 },
};

export const PREP_SETTINGS_ID = "prep-settings";
export const PREP_SEEN_ID = "prep-seen";
export const pinId = (lessonKey: string) => `prep-pin:${lessonKey}`;
export const doneId = (lessonKey: string) => `nachbereitet:${lessonKey}`;

type SettingsMark = Mark & { prepSettings?: Partial<PrepSettings> };
type PinMark = Mark & { pin?: number };
type SeenMark = Mark & { seen?: Record<string, number> };

const BUFFER = 15 * MIN; // Weg und Pause rund um Termine und zwischen Einheiten
const HORIZON_DAYS = 120; // so weit voraus wird geplant
const AHEAD_DAYS = 21; // kommende Vorlesungen bekommen ihre Einheit schon jetzt (Kalender, Erinnerungen)

export function readPrepSettings(marks: Mark[]): PrepSettings {
  const m = marks.find((x) => x.id === PREP_SETTINGS_ID) as SettingsMark | undefined;
  const s = m?.prepSettings ?? {};
  return {
    ...DEFAULT_PREP,
    ...s,
    weekday: { ...DEFAULT_PREP.weekday, ...s.weekday },
    weekend: { ...DEFAULT_PREP.weekend, ...s.weekend },
  };
}

export const prepSettingsMark = (s: PrepSettings): SettingsMark => ({ id: PREP_SETTINGS_ID, createdAt: Date.now(), prepSettings: s });
export const pinMark = (lessonKey: string, start: number): PinMark => ({ id: pinId(lessonKey), createdAt: Date.now(), pin: start });

export function readSeen(marks: Mark[]): Record<string, number> | null {
  return (marks.find((x) => x.id === PREP_SEEN_ID) as SeenMark | undefined)?.seen ?? null;
}

export const seenMark = (plan: PrepPlan): SeenMark => ({ id: PREP_SEEN_ID, createdAt: Date.now(), seen: snapshot(plan) });

/** Beginn des Semesters: frühester Stundenplan-Start der letzten 200 Tage, sonst vor fünf Wochen. */
export function semesterStart(data: PlannerData, now: number) {
  const limit = addDays(dayStart(now), -200);
  const starts = data.slots.map((s) => parseIsoDate(s.from)).filter((t) => t >= limit && t <= now);
  return starts.length ? Math.min(...starts) : addDays(dayStart(now), -35);
}

type Interval = [number, number];

/** Belegte Zeiten: alle Termine mit Uhrzeit, dazu ganztägige Prüfungen und eigene Termine (z. B. "Keine Zeit"). */
function busyTimes(data: PlannerData, from: number, to: number): { iv: Interval; o: Occurrence }[] {
  return occurrences({ ...data, todos: [] }, from, to)
    .filter((o) => !o.allDay || o.kind === "exam" || o.kind === "other")
    .map((o) => ({ iv: (o.allDay ? [dayStart(o.start), Math.max(o.end, dayStart(o.start) + DAYMS)] : [o.start - BUFFER, o.end + BUFFER]) as Interval, o }));
}

const overlaps = (a: Interval, b: Interval) => a[0] < b[1] && b[0] < a[1];

/** Freie Zeitfenster für Einheiten (ohne Rücksicht auf schon geplante Einheiten). */
function freeSlots(data: PlannerData, s: PrepSettings, now: number, days = HORIZON_DAYS): Interval[] {
  const today = dayStart(now);
  const busy = busyTimes(data, addDays(today, -1), addDays(today, days + 1)).map((b) => b.iv);
  const len = s.minutes * MIN;
  const out: Interval[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const weekend = isoWeekday(day) >= 6;
    const win = weekend ? s.weekend : s.weekday;
    if (weekend && !s.weekend.on) continue;
    const end = atTime(day, win.to);
    let t = atTime(day, win.from);
    while (t + len <= end) {
      const slot: Interval = [t, t + len];
      const hit = busy.filter((b) => overlaps(b, slot));
      if (hit.length) {
        t = Math.max(...hit.map((b) => b[1])); // hinter den Termin springen
        continue;
      }
      if (slot[1] > now) out.push(slot);
      t += len + BUFFER;
    }
  }
  return out;
}

export type PrepSession = Occurrence & { lesson: Occurrence; pinned: boolean };

export type PrepPlan = {
  settings: PrepSettings;
  since: number;
  sessions: PrepSession[]; // chronologisch
  backlog: Occurrence[]; // vergangene, noch nicht nachbereitete Vorlesungen (älteste zuerst)
  unplanned: Occurrence[]; // fanden im Planungszeitraum keinen Platz
  catchUp: number | null; // Ende der letzten Einheit für den Rückstand
  weeks: { start: number; lessons: { o: Occurrence; done: boolean }[] }[]; // zum wöchentlichen Abhaken
};

function session(lesson: Occurrence, iv: Interval, pinned: boolean): PrepSession {
  return {
    key: `prep:${lesson.key}`,
    title: `Nachbereitung: ${lesson.course}`,
    course: lesson.course,
    kind: "other",
    type: `Nachbereitung · Vorlesung vom ${fmtShortDay(lesson.start)}`,
    start: iv[0],
    end: iv[1],
    allDay: false,
    location: "",
    note: "",
    origin: { kind: "prep", id: lesson.key },
    lesson,
    pinned,
  };
}

export function prepPlan(data: PlannerData, lectures: LectureLite[], marks: Mark[], now = Date.now()): PrepPlan {
  const settings = readPrepSettings(marks);
  const since = semesterStart(data, now);
  const backlog = pendingSince(data, lectures, marks, since, now);
  const held = occurrences({ ...data, todos: [] }, since, now).filter((o) => isLectureType(o) && o.end <= now);
  const open = new Set(backlog.map((o) => o.key));
  const weeks: PrepPlan["weeks"] = [];
  for (const o of held) {
    const ws = addDays(dayStart(o.start), 1 - isoWeekday(o.start));
    let w = weeks.find((x) => x.start === ws);
    if (!w) weeks.push((w = { start: ws, lessons: [] }));
    w.lessons.push({ o, done: !open.has(o.key) });
  }
  const empty: PrepPlan = { settings, since, sessions: [], backlog, unplanned: [], catchUp: null, weeks };
  if (!settings.on) return { ...empty, unplanned: backlog };

  // Kommende Vorlesungen: die Einheit kommt nach der Vorlesung, am selben Tag, wenn Platz ist
  const done = new Set(marks.filter((m) => m.id.startsWith("nachbereitet:")).map((m) => m.id.slice("nachbereitet:".length)));
  const ahead = occurrences({ ...data, todos: [] }, now, addDays(dayStart(now), AHEAD_DAYS)).filter(
    (o) => isLectureType(o) && o.end > now && !done.has(o.key),
  );
  const queue = [...backlog, ...ahead];
  const len = settings.minutes * MIN;
  const slots = freeSlots(data, settings, now);
  const used = new Map<number, number>(); // Tag -> geplante Minuten
  const taken: Interval[] = [];
  const sessions: PrepSession[] = [];

  // 1. Fest gelegte Zeiten, wenn dort nichts anderes liegt
  const busy = busyTimes(data, addDays(dayStart(now), -1), addDays(dayStart(now), HORIZON_DAYS + 1)).map((b) => b.iv);
  const pins = new Map(marks.filter((m) => m.id.startsWith("prep-pin:")).map((m) => [m.id.slice("prep-pin:".length), (m as PinMark).pin ?? 0]));
  for (const lesson of [...queue]) {
    const at = pins.get(lesson.key);
    if (!at) continue;
    const iv: Interval = [at, at + len];
    if (iv[1] <= now || at < lesson.end || busy.some((b) => overlaps(b, [at, at + len])) || taken.some((t) => overlaps(t, iv))) continue;
    sessions.push(session(lesson, iv, true));
    taken.push(iv);
    used.set(dayStart(at), (used.get(dayStart(at)) ?? 0) + settings.minutes);
    queue.splice(queue.indexOf(lesson), 1);
  }

  // 2. Der Rest der Reihe nach: frische Vorlesungen (heute, gestern) zuerst, dann die älteste offene
  for (const iv of slots) {
    if (!queue.length) break;
    const day = dayStart(iv[0]);
    const max = isoWeekday(day) >= 6 ? settings.weekend.max : settings.weekday.max;
    if ((used.get(day) ?? 0) + settings.minutes > max || taken.some((t) => overlaps(t, iv))) continue;
    const ready = queue.filter((o) => o.end <= iv[0]);
    if (!ready.length) continue;
    const fresh = ready.filter((o) => dayStart(o.start) >= addDays(day, -1));
    const pick = (fresh.length ? fresh : ready).reduce((a, b) => (b.start < a.start ? b : a));
    sessions.push(session(pick, iv, false));
    taken.push(iv);
    used.set(day, (used.get(day) ?? 0) + settings.minutes);
    queue.splice(queue.indexOf(pick), 1);
  }

  sessions.sort((a, b) => a.start - b.start);
  const last = sessions.filter((x) => open.has(x.lesson.key)).at(-1);
  return {
    ...empty,
    sessions,
    unplanned: queue.filter((o) => open.has(o.key) || o.end <= addDays(dayStart(now), 7)),
    catchUp: backlog.length && !queue.some((o) => open.has(o.key)) ? (last?.end ?? null) : null,
  };
}

/** Geplante Einheiten, die einen Zeitraum berühren (für Kalender und Tagesliste). */
export const sessionsIn = (plan: PrepPlan, from: number, to: number) => plan.sessions.filter((x) => x.end > from && x.start < to);

/** Lektion -> Beginn der Einheit, für die nächsten 14 Tage (merkt sich, was der Nutzer gesehen hat). */
export function snapshot(plan: PrepPlan, now = Date.now()): Record<string, number> {
  const until = addDays(dayStart(now), 14);
  return Object.fromEntries(plan.sessions.filter((x) => x.start < until).map((x) => [x.lesson.key, x.start]));
}

export type Moved = { session: PrepSession | null; lesson: Occurrence; from: number; cause: string };

/**
 * Was wurde nach hinten verschoben, seit der Nutzer den Plan zuletzt gesehen hat, und warum: wegen eines
 * Termins oder weil die Einheit verpasst wurde. Frühere Einheiten (weil etwas erledigt wurde) zählen nicht.
 */
export function postponed(prev: Record<string, number> | null, plan: PrepPlan, data: PlannerData, now = Date.now()): Moved[] {
  if (!prev) return [];
  const byKey = new Map(plan.sessions.map((x) => [x.lesson.key, x]));
  const open = new Set([...plan.backlog, ...plan.sessions.map((x) => x.lesson)].map((o) => o.key));
  const len = plan.settings.minutes * MIN;
  const busy = busyTimes(data, addDays(dayStart(now), -15), addDays(dayStart(now), 30));
  const out: Moved[] = [];
  for (const [key, from] of Object.entries(prev)) {
    if (!open.has(key)) continue; // erledigt
    const s = byKey.get(key) ?? null;
    if (s && s.start <= from) continue;
    const hit = busy.find((b) => overlaps(b.iv, [from, from + len]));
    const cause = hit ? `wegen „${hit.o.title}“` : from + len <= now ? "nicht erledigt" : "";
    if (!cause) continue;
    const lesson = s?.lesson ?? plan.backlog.find((o) => o.key === key);
    if (lesson) out.push({ session: s, lesson, from, cause });
  }
  return out.sort((a, b) => a.from - b.from);
}

/** Bis zu `count` freie Zeiten für eine Einheit (nicht belegt, keine andere Einheit), möglichst an verschiedenen Tagen. */
export function alternatives(data: PlannerData, plan: PrepPlan, lesson: Occurrence, now = Date.now(), count = 3): number[] {
  const out: number[] = [];
  const own = plan.sessions.find((x) => x.lesson.key === lesson.key);
  for (const iv of freeSlots(data, plan.settings, now, 21)) {
    if (iv[0] < Math.max(now, lesson.end) || iv[0] === own?.start) continue;
    if (plan.sessions.some((x) => x !== own && overlaps([x.start, x.end], iv))) continue;
    if (out.some((t) => isoDate(t) === isoDate(iv[0]))) continue;
    out.push(iv[0]);
    if (out.length >= count) break;
  }
  return out;
}

/** Ist "HH:MM" gültig und liegt `to` nach `from`? */
export function validWindow(from: string, to: string) {
  const ok = (t: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t);
  return ok(from) && ok(to) && parseTime(to) > parseTime(from);
}
