// Berechnet, wann Jarvis welche Push-Nachricht schickt. Die App legt den Plan in Supabase ab,
// der Server verschickt ihn zur fälligen Zeit (siehe /api/push/tick). Gerechnet wird in der
// Ortszeit des Geräts (Basel).

import type { Mark, Todo } from "./assistant";
import {
  addDays,
  atTime,
  dayStart,
  fmtShortDay,
  fmtTime,
  HOUR,
  MIN,
  occurrences,
  parseIsoDate,
  parseTime,
  type Occurrence,
  type PlannerData,
} from "./planner";

export type Reminder = { key: string; dueAt: number; title: string; body: string; url: string };

export const REMINDER_KINDS = [
  { id: "todos", label: "Aufgaben und Fristen", hint: "1 Woche vorher, 1 Tag vorher und am Tag selbst" },
  { id: "exams", label: "Prüfungen", hint: "1 Woche vorher, am Vorabend und 2 Stunden vorher" },
  { id: "lectures", label: "Lektionen", hint: "20 Minuten vorher, mit Raum" },
  { id: "prep", label: "Nachbereitung", hint: "10 Minuten vor jeder geplanten Einheit" },
  { id: "weekly", label: "Wochenrückblick", hint: "sonntags um 18 Uhr" },
] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number]["id"];

/** Ausgeschaltete Arten werden als Markierung "push-off:<art>" gespeichert (gilt auf allen Geräten). */
export const pushOffMark = (kind: ReminderKind) => `push-off:${kind}`;
export const PUSH_ENABLED_MARK = "push:enabled";

export function enabledKinds(marks: Mark[]): Set<ReminderKind> {
  return new Set(REMINDER_KINDS.map((k) => k.id).filter((id) => !marks.some((m) => m.id === pushOffMark(id))));
}

const at = atTime;
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const STEPS = [
  { days: 7, tag: "7d" },
  { days: 1, tag: "1d" },
  { days: 0, tag: "0d" },
] as const;

function todoReminders(t: Todo, now: number): Reminder[] {
  if (t.done || !t.due) return [];
  const day = parseIsoDate(t.due);
  const when = `${fmtShortDay(day)}${t.time ? `, ${t.time}` : ""}`;
  return STEPS.map(({ days, tag }) => {
    let dueAt = at(addDays(day, -days), "08:00");
    // Am Tag selbst: bei früher Uhrzeit eine Stunde vorher statt um 8 Uhr
    if (days === 0 && t.time && parseTime(t.time) < parseTime("09:00")) dueAt = at(day, t.time) - HOUR;
    const title = days === 7 ? `In einer Woche: ${t.title}` : days === 1 ? `Morgen: ${t.title}` : `Heute: ${t.title}`;
    return {
      key: `todo:${t.id}:${t.due}:${tag}`,
      dueAt,
      title: clip(title, 80),
      body: clip(`${when}${t.note ? ` · ${t.note}` : ""}`),
      url: "/aufgaben",
    };
  }).filter((r) => r.dueAt > now);
}

function examReminders(o: Occurrence, now: number): Reminder[] {
  const name = o.course || o.title.replace(/^prüfung:?\s*/i, "");
  const when = `${fmtShortDay(o.start)}${o.allDay ? "" : `, ${fmtTime(o.start)}`}${o.location ? ` · ${o.location}` : ""}`;
  const list: Reminder[] = [
    { key: `exam:${o.key}:${o.start}:7d`, dueAt: at(addDays(o.start, -7), "18:00"), title: `Prüfung in einer Woche: ${name}`, body: when, url: "/lernplan" },
    { key: `exam:${o.key}:${o.start}:1d`, dueAt: at(addDays(o.start, -1), "18:00"), title: `Morgen Prüfung: ${name}`, body: `${when}. Viel Erfolg!`, url: "/lernplan" },
    {
      key: `exam:${o.key}:${o.start}:0d`,
      dueAt: o.allDay ? at(o.start, "07:00") : o.start - 2 * HOUR,
      title: `Heute Prüfung: ${name}`,
      body: when,
      url: "/",
    },
  ];
  return list.map((r) => ({ ...r, title: clip(r.title, 80), body: clip(r.body) })).filter((r) => r.dueAt > now);
}

function deadlineReminders(o: Occurrence, now: number): Reminder[] {
  // Fristen aus dem Kalender (nicht Aufgaben, die haben eigene Erinnerungen)
  return STEPS.map(({ days, tag }) => ({
    key: `deadline:${o.key}:${o.start}:${tag}`,
    dueAt: at(addDays(o.start, -days), "08:00"),
    title: clip(days === 7 ? `Frist in einer Woche: ${o.title}` : days === 1 ? `Frist morgen: ${o.title}` : `Frist heute: ${o.title}`, 80),
    body: clip(`${fmtShortDay(o.start)}${o.note ? ` · ${o.note}` : ""}`),
    url: "/kalender",
  })).filter((r) => r.dueAt > now);
}

function lectureReminder(o: Occurrence, now: number): Reminder | null {
  const dueAt = o.start - 20 * MIN;
  if (dueAt <= now) return null;
  return {
    key: `lecture:${o.key}`,
    dueAt,
    title: clip(`In 20 Min.: ${o.title}`, 80),
    body: clip(`${fmtTime(o.start)}–${fmtTime(o.end)}${o.location ? ` · ${o.location}` : ""}`),
    url: "/",
  };
}

/** Alle Erinnerungen der nächsten Wochen (Lektionen nur 14 Tage, damit der Plan klein bleibt). */
export function buildReminders(data: PlannerData, todos: Todo[], kinds: Set<ReminderKind>, now = Date.now(), prep: Occurrence[] = []): Reminder[] {
  const out: Reminder[] = [];
  const horizon = addDays(dayStart(now), 60);
  const list = occurrences({ ...data, todos: [] }, now - HOUR, addDays(horizon, 7));

  if (kinds.has("todos")) {
    for (const t of todos) out.push(...todoReminders(t, now).filter((r) => r.dueAt < horizon));
    for (const o of list) if (o.kind === "deadline" && o.origin.kind === "event") out.push(...deadlineReminders(o, now).filter((r) => r.dueAt < horizon));
  }
  if (kinds.has("exams")) {
    for (const o of list) if (o.kind === "exam") out.push(...examReminders(o, now).filter((r) => r.dueAt < horizon));
  }
  if (kinds.has("lectures")) {
    const until = addDays(dayStart(now), 14);
    for (const o of list) {
      if (o.kind !== "lecture" || o.allDay || o.start > until) continue;
      const r = lectureReminder(o, now);
      if (r) out.push(r);
    }
  }
  if (kinds.has("prep")) {
    // Einheiten aus dem Nachbereitungsplan; verschiebt sich eine, ändert sich der Schlüssel und die alte fällt weg
    const until = addDays(dayStart(now), 14);
    for (const o of prep) {
      const dueAt = o.start - 10 * MIN;
      if (dueAt <= now || o.start > until) continue;
      out.push({
        key: `prep:${o.origin.id}:${o.start}`,
        dueAt,
        title: clip(`In 10 Min.: ${o.title}`, 80),
        body: clip(`${fmtTime(o.start)}–${fmtTime(o.end)} · ${o.type.replace(/^Nachbereitung · /, "")}`),
        url: "/lernplan",
      });
    }
  }
  if (kinds.has("weekly")) {
    // die nächsten drei Sonntage, 18 Uhr
    let sunday = dayStart(now);
    while (new Date(sunday).getDay() !== 0) sunday = addDays(sunday, 1);
    for (let i = 0; i < 3; i++) {
      const d = addDays(sunday, i * 7);
      const dueAt = at(d, "18:00");
      if (dueAt > now)
        out.push({
          key: `weekly:${dueAt}`,
          dueAt,
          title: "Dein Wochenrückblick",
          body: "Was ist diese Woche noch nachzubereiten, und was steht nächste Woche an?",
          url: "/lernplan#rueckblick",
        });
    }
  }
  return out.sort((a, b) => a.dueAt - b.dueAt);
}
