// Stundenplan aus dem Kalender-Abo der Uni Basel (Online-Services → unical.unibas.ch).
// Das Abo liefert jede einzelne Lektion mit Raum, aber keine Wiederholungsregeln. Daraus werden
// wöchentliche Einträge (Slots) und Prüfungen gebaut. Das Abo wird bei jedem Abruf frisch erzeugt,
// neue Belegungen und Raumänderungen kommen also von selbst; für ein neues Semester braucht es
// eventuell eine neue Abo-Adresse.

import { addDays, dayStart, isoDate, isoWeekday, MIN, type CalEvent, type FeedEvent, type Slot } from "./planner";

export const TIMETABLE_FEED_NAME = "Stundenplan Uni Basel";
/** Feste ID: Auf beiden Laptops entsteht so dasselbe Abo statt zwei. */
export const TIMETABLE_FEED_ID = "abo-stundenplan";

/** Abo-Adressen, die einen Stundenplan liefern. */
export function isTimetableUrl(url: string) {
  return /(^|\/\/)unical\.unibas\.ch\//i.test(url.trim());
}

const CANCELLED = /fällt aus|faellt aus|entfällt|no lecture|cancel+ed|abgesagt/i;

const TYPES: [RegExp, string][] = [
  [/^hauptvorlesung|^vorlesung|^haup|^vorl/i, "Vorlesung"],
  [/^übung|^uebung|^übun/i, "Übung"],
  [/^seminar|^semi/i, "Seminar"],
  [/^praktikum|^prak/i, "Praktikum"],
  [/^kolloquium|^koll/i, "Kolloquium"],
  [/^tutorat|^tuto/i, "Tutorat"],
  [/^kurs/i, "Kurs"],
];

type Parsed = {
  exam: boolean;
  code: string; // "10380"
  section: string; // "01"
  type: string;
  course: string;
  room: string;
  cancelled: boolean;
};

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** "10551-09 Übun: Mathematik I für Naturwissenschaften (Pharmazeutische Wissenschaften)" zerlegen. */
function parseEntry(e: FeedEvent): Parsed | null {
  const m = /^(P\s+)?(\d{3,6})-(\d+)\s+([^:]+):\s*(.+)$/.exec(e.title.trim());
  if (!m) return null;
  const [, p, code, section, abbr, rest] = m;
  // Beschreibung: Semester, Nummer, "Hauptvorlesung: Titel", Rhythmus, Raum, Link
  const lines = e.description.split("\n").map((l) => l.trim());
  const full = lines.find((l) => /^[^:]{3,40}:\s/.test(l) && l.includes(rest.slice(0, 12)));
  const typeWord = full ? full.split(":")[0] : abbr;
  const title = full ? full.slice(full.indexOf(":") + 1).trim() : rest;
  if (/^stream from/i.test(title)) return null; // Übertragung in einen Nebenraum, keine eigene Lektion
  return {
    exam: !!p || /^prüfung:/i.test(title),
    code,
    section,
    type: TYPES.find(([re]) => re.test(typeWord))?.[1] ?? typeWord,
    // "(Pharmazeutische Wissenschaften)" am Ende kennzeichnet nur die Gruppe
    course: title.replace(/^prüfung:\s*/i, "").replace(/\s*\([^()]*\)\s*$/, "").trim(),
    room: e.location.trim(),
    cancelled: CANCELLED.test(e.location) || CANCELLED.test(e.title),
  };
}

const mostCommon = (list: string[]) => {
  const counts = new Map<string, number>();
  for (const x of list) if (x) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
};

export type DerivedTimetable = { slots: Slot[]; exams: CalEvent[] };

/** Baut aus den Einzelterminen des Abos wöchentliche Einträge und Prüfungen. */
export function deriveTimetable(events: FeedEvent[], now = Date.now()): DerivedTimetable {
  type Group = {
    p: Parsed;
    weekday: number;
    start: string;
    end: string;
    days: number[];
    held: number[];
    rooms: string[];
    roomByDay: Map<number, string>;
  };
  const groups = new Map<string, Group>();
  const examGroups = new Map<string, { p: Parsed; start: number; end: number | null; rooms: string[] }>();

  for (const e of events) {
    if (e.allDay) continue;
    const p = parseEntry(e);
    if (!p) continue;
    if (p.exam) {
      const key = `${p.code}|${e.start}`;
      const g = examGroups.get(key) ?? { p, start: e.start, end: e.end, rooms: [] };
      if (p.room && !g.rooms.includes(p.room)) g.rooms.push(p.room);
      examGroups.set(key, g);
      continue;
    }
    const start = hhmm(e.start);
    const end = hhmm(e.end ?? e.start + 45 * MIN);
    const weekday = isoWeekday(e.start);
    const key = `${p.code}-${p.section}|${weekday}|${start}|${end}`;
    const g: Group = groups.get(key) ?? { p, weekday, start, end, days: [], held: [], rooms: [], roomByDay: new Map() };
    const day = dayStart(e.start);
    g.days.push(day);
    if (!p.cancelled) {
      g.held.push(day);
      g.rooms.push(p.room);
      g.roomByDay.set(day, p.room);
    }
    groups.set(key, g);
  }

  const slots: Slot[] = [];
  for (const g of groups.values()) {
    if (!g.held.length) continue; // nur ausgefallene Termine
    const held = [...new Set(g.held)].sort((a, b) => a - b);
    const first = held[0];
    const last = held.at(-1)!;
    const skip: string[] = [];
    for (let d = first; d <= last; d = addDays(d, 7)) if (!held.includes(d)) skip.push(isoDate(d));
    const room = mostCommon(g.rooms);
    const roomOn: Record<string, string> = {};
    for (const [d, r] of g.roomByDay) if (r !== room) roomOn[isoDate(d)] = r || "kein Raum angegeben";
    slots.push({
      id: `abo-${g.p.code}-${g.p.section}-${g.weekday}-${g.start.replace(":", "")}`,
      course: g.p.course,
      code: g.p.code,
      type: g.p.type,
      weekday: g.weekday,
      start: g.start,
      end: g.end,
      room,
      from: isoDate(first),
      until: isoDate(last),
      ...(skip.length ? { skip } : {}),
      ...(Object.keys(roomOn).length ? { roomOn } : {}),
      createdAt: now,
    });
  }

  const exams: CalEvent[] = [...examGroups.values()].map((g) => ({
    id: `abo-exam-${g.p.code}-${isoDate(g.start)}`,
    title: `Prüfung ${g.p.course}`,
    course: g.p.course,
    kind: "exam",
    start: g.start,
    end: g.end,
    allDay: false,
    location: g.rooms.join(" / "),
    note: `Examen ${g.p.code}, laut Stundenplan-Abo der Uni Basel. Massgebend sind die Angaben in den Online-Services.`,
    source: "manual",
    createdAt: now,
  }));

  slots.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  exams.sort((a, b) => a.start - b.start);
  return { slots, exams };
}

/** Enthält das Abo noch kommende Lektionen? Wenn nicht, ist vermutlich ein neues Semester fällig. */
export function hasUpcomingLessons(events: FeedEvent[], now = Date.now()) {
  return events.some((e) => e.start > now && !parseEntry(e)?.exam);
}
