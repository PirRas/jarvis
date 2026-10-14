// Uni-Cockpit: Stundenplan, Termine, Kalender-Abos und Links.
// Alles wird zu einer gemeinsamen Zeitleiste ("Vorkommen") zusammengeführt.

import type { Todo } from "./assistant";
import { sameCourse } from "./courses";
import { lectureFree } from "./uniDates";

type Synced = { updatedAt?: number };

export type EventKind = "exam" | "lecture" | "deadline" | "other";

export const KIND_LABEL: Record<EventKind, string> = {
  exam: "Prüfung",
  lecture: "Lehrveranstaltung",
  deadline: "Frist",
  other: "Termin",
};

/** Wöchentlich wiederkehrende Lehrveranstaltung. */
export type Slot = Synced & {
  id: string;
  course: string;
  code?: string; // Nummer im Vorlesungsverzeichnis, z. B. "10380"; damit wird der Raum live geprüft
  type: string; // Vorlesung, Übung, Seminar, Praktikum …
  weekday: number; // 1 = Montag … 7 = Sonntag
  start: string; // "10:15"
  end: string; // "12:00"
  room: string;
  from: string; // "2026-09-14" (erster möglicher Termin)
  until: string; // "2026-12-18" (letzter möglicher Termin)
  biweekly?: boolean; // nur alle zwei Wochen, ab `from`
  skip?: string[]; // ausfallende Tage, z. B. Dies Academicus ("2026-11-27")
  roomOn?: Record<string, string>; // abweichender Raum an einzelnen Tagen ("2026-10-22": "Kollegienhaus, Hörsaal 118")
  createdAt: number;
};

/** Einzeltermin, selbst angelegt, aus Text erkannt oder von Jarvis aus Mails übernommen. */
export type CalEvent = Synced & {
  id: string;
  title: string;
  course: string;
  kind: EventKind;
  start: number; // ms
  end: number | null;
  allDay: boolean;
  location: string;
  note: string;
  source: "manual" | "text" | "mail";
  createdAt: number;
};

/** Kalender-Abo (iCal-Adresse), z. B. aus ADAM oder Outlook. */
export type Feed = Synced & {
  id: string;
  name: string;
  url: string;
  /** "timetable": Stundenplan-Abo der Uni; daraus werden Stundenplan und Prüfungen gebaut, statt die Termine einzeln zu zeigen. */
  role?: "timetable";
  createdAt: number;
};

/** Zwischengespeicherte Termine eines Abos (nur auf diesem Gerät). */
export type FeedCache = {
  id: string; // = Feed-ID
  fetchedAt: number;
  error: string | null;
  events: FeedEvent[];
};

export type FeedEvent = {
  uid: string;
  title: string;
  start: number;
  end: number | null;
  allDay: boolean;
  location: string;
  description: string;
};

export type QuickLink = Synced & {
  id: string;
  name: string;
  url: string;
  group: string;
  order: number;
};

/** Vorschau auf eine Lektion: aus den Folien erkannte Themen und eine Kurzzusammenfassung. */
export type LessonPreview = Synced & {
  id: string; // `${normalisiertes Fach}|${YYYY-MM-DD}`
  course: string;
  date: string; // YYYY-MM-DD
  fileName: string;
  topics: string[];
  text: string; // ausgelesener Folientext (gekürzt) für den Claude-Prompt
  summary: string; // Markdown, von Claude
  createdAt: number;
};

/** Ein konkretes Vorkommen in der Zeitleiste. */
export type Occurrence = {
  key: string;
  title: string;
  course: string;
  code?: string;
  kind: EventKind;
  type: string; // z. B. "Vorlesung" oder Name des Abos
  start: number;
  end: number;
  allDay: boolean;
  location: string;
  note: string;
  origin:
    | { kind: "slot"; id: string }
    | { kind: "event"; id: string }
    | { kind: "feed"; id: string; name: string }
    | { kind: "todo"; id: string };
};

// ---------- Datum und Zeit ----------

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAYMS = 24 * HOUR;

export const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export function dayStart(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(t: number, n: number) {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Lokales Datum als YYYY-MM-DD. */
export function isoDate(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseIsoDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

/** Zeitpunkt "HH:MM" an einem Tag in Ortszeit (auch an Tagen mit Zeitumstellung korrekt). */
export function atTime(day: number, hhmm: string) {
  const d = new Date(day);
  const m = parseTime(hhmm);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d.getTime();
}

/** "10:15" -> Minuten seit Mitternacht. */
export function parseTime(s: string) {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Montag = 1 … Sonntag = 7 */
export function isoWeekday(t: number) {
  return ((new Date(t).getDay() + 6) % 7) + 1;
}

/** Montag 00:00 der Woche von t. */
export function weekStart(t: number) {
  return addDays(dayStart(t), 1 - isoWeekday(t));
}

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
export const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
export const fmtShortDay = (t: number) =>
  new Date(t).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" });
export const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });

/** "heute", "morgen", "in 5 Tagen" … */
export function relDay(t: number, now = Date.now()) {
  const diff = Math.round((dayStart(t) - dayStart(now)) / DAYMS);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === -1) return "gestern";
  if (diff > 1) return `in ${diff} Tagen`;
  return `vor ${-diff} Tagen`;
}

/** "in 25 Min.", "in 3 Std. 10 Min.", "morgen" … */
export function relTime(t: number, now = Date.now()) {
  const mins = Math.round((t - now) / MIN);
  if (mins <= 0) return "jetzt";
  if (mins < 60) return `in ${mins} Min.`;
  if (mins < 12 * 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `in ${h} Std. ${m} Min.` : `in ${h} Std.`;
  }
  return relDay(t, now);
}

/** Vorlesungszeit des laufenden Semesters an der Uni Basel (ungefähr; pro Eintrag änderbar). */
export function defaultSemester(now = Date.now()) {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (m >= 8) return { from: `${y}-09-14`, until: `${y}-12-18` }; // Herbstsemester
  if (m === 1) return { from: `${y - 1}-09-14`, until: `${y}-01-10` };
  return { from: `${y}-02-16`, until: `${y}-05-29` }; // Frühjahrssemester
}

// ---------- Erkennen von Prüfungen und Fristen ----------

const EXAM_RE = /(prüfung|pruefung|klausur|\bexam|examen|midterm|testat|leistungsüberprüfung|zwischentest|nachholtermin)/i;
const DEADLINE_RE = /(abgabe|deadline|frist|einsendeschluss|anmeldeschluss|anmeldung|abmeldung|einreichen)/i;

export function looksLikeExam(text: string) {
  return EXAM_RE.test(text);
}

export function guessKind(text: string): EventKind {
  if (looksLikeExam(text)) return "exam";
  if (DEADLINE_RE.test(text)) return "deadline";
  return "other";
}

// ---------- Zeitleiste ----------

export function slotOccurrences(slot: Slot, from: number, to: number): Occurrence[] {
  const out: Occurrence[] = [];
  const first = parseIsoDate(slot.from);
  const last = parseIsoDate(slot.until) + DAYMS;
  // ersten passenden Wochentag ab `first` suchen
  let day = dayStart(first);
  while (isoWeekday(day) !== slot.weekday) day = addDays(day, 1);
  const anchor = day;
  for (; day < last && day < to; day = addDays(day, 7)) {
    if (slot.biweekly && Math.round((day - anchor) / DAYMS / 7) % 2 === 1) continue;
    if (slot.skip?.includes(isoDate(day))) continue;
    if (lectureFree(isoDate(day))) continue; // offiziell vorlesungsfrei (z. B. Dies Academicus)
    const start = atTime(day, slot.start);
    const end = Math.max(atTime(day, slot.end), start + 15 * MIN);
    if (end < from) continue;
    out.push({
      key: `slot:${slot.id}:${isoDate(day)}`,
      title: slot.course,
      course: slot.course,
      code: slot.code,
      kind: "lecture",
      type: slot.type || "Lehrveranstaltung",
      start,
      end,
      allDay: false,
      location: slot.roomOn?.[isoDate(day)] ?? slot.room,
      note: "",
      origin: { kind: "slot", id: slot.id },
    });
  }
  return out;
}

function eventOccurrence(e: CalEvent): Occurrence {
  return {
    key: `event:${e.id}`,
    title: e.title,
    course: e.course,
    kind: e.kind,
    type: KIND_LABEL[e.kind],
    start: e.start,
    end: e.end ?? (e.allDay ? e.start + DAYMS : e.start + HOUR),
    allDay: e.allDay,
    location: e.location,
    note: e.note,
    origin: { kind: "event", id: e.id },
  };
}

function feedOccurrence(feed: Feed, e: FeedEvent, courses: string[]): Occurrence {
  const text = `${e.title} ${e.description}`;
  const kind = guessKind(e.title);
  return {
    key: `feed:${feed.id}:${e.uid}:${e.start}`,
    title: e.title,
    course: courses.find((c) => text.toLowerCase().includes(c.toLowerCase()) || sameCourse(c, e.title)) ?? "",
    kind,
    type: feed.name,
    start: e.start,
    end: e.end ?? (e.allDay ? e.start + DAYMS : e.start + HOUR),
    allDay: e.allDay,
    location: e.location,
    note: e.description,
    origin: { kind: "feed", id: feed.id, name: feed.name },
  };
}

export type PlannerData = {
  slots: Slot[];
  events: CalEvent[];
  feeds: Feed[];
  caches: FeedCache[];
  todos?: Todo[]; // offene Aufgaben mit Termin erscheinen als Frist
};

export const EMPTY_PLANNER: PlannerData = { slots: [], events: [], feeds: [], caches: [], todos: [] };

/** Offene Aufgabe mit Termin als Frist in der Zeitleiste. */
function todoOccurrence(t: Todo): Occurrence | null {
  if (!t.due || t.done) return null;
  const day = parseIsoDate(t.due);
  const start = t.time ? atTime(day, t.time) : day;
  return {
    key: `todo:${t.id}`,
    title: t.title,
    course: "",
    kind: "deadline",
    type: `Aufgabe · ${t.category}`,
    start,
    end: t.time ? start + 30 * MIN : day + DAYMS,
    allDay: !t.time,
    location: "",
    note: t.note,
    origin: { kind: "todo", id: t.id },
  };
}

/** Alle Fächer, die im Stundenplan oder in Terminen vorkommen. */
export function knownCourses(data: PlannerData, extra: string[] = []) {
  const out: string[] = [];
  for (const c of [...data.slots.map((s) => s.course), ...data.events.map((e) => e.course), ...extra]) {
    if (c && !out.some((o) => sameCourse(o, c))) out.push(c);
  }
  return out;
}

/** Alle Vorkommen, die den Zeitraum [from, to) berühren, chronologisch. */
export function occurrences(data: PlannerData, from: number, to: number, courses: string[] = []): Occurrence[] {
  const out: Occurrence[] = [];
  for (const s of data.slots) out.push(...slotOccurrences(s, from, to));
  for (const e of data.events) {
    const o = eventOccurrence(e);
    if (o.end > from && o.start < to) out.push(o);
  }
  for (const t of data.todos ?? []) {
    const o = todoOccurrence(t);
    if (o && o.end > from && o.start < to) out.push(o);
  }
  for (const feed of data.feeds) {
    if (feed.role === "timetable") continue; // steckt schon in Stundenplan und Prüfungen
    const cache = data.caches.find((c) => c.id === feed.id);
    for (const e of cache?.events ?? []) {
      const o = feedOccurrence(feed, e, courses);
      if (o.end > from && o.start < to) out.push(o);
    }
  }
  return out.sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay));
}

/** Was läuft gerade, und was kommt als Nächstes (ganztägige Einträge zählen nicht als "Nächstes"). */
export function nowAndNext(list: Occurrence[], now = Date.now()) {
  const timed = list.filter((o) => !o.allDay);
  const current = timed.filter((o) => o.start <= now && o.end > now);
  const next = timed.find((o) => o.start > now) ?? null;
  return { current, next };
}

export function upcomingExams(list: Occurrence[], now = Date.now()) {
  return list.filter((o) => o.kind === "exam" && o.end > now);
}

/** ID für die Vorschau einer Lektion: gleiches Fach am gleichen Tag. */
export function previewId(course: string, start: number) {
  const norm = course
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `${norm}|${isoDate(start)}`;
}

// ---------- Links ----------

/** Links nach Gruppe, in der Reihenfolge ihres ersten Auftretens. */
export function groupLinks<T extends { group: string }>(links: T[]) {
  const groups: { name: string; items: T[] }[] = [];
  for (const l of links) {
    const g = groups.find((g) => g.name === l.group);
    if (g) g.items.push(l);
    else groups.push({ name: l.group, items: [l] });
  }
  return groups;
}

export const DEFAULT_LINKS: Omit<QuickLink, "id">[] = [
  // Jeden Tag
  { name: "ADAM", url: "https://adam.unibas.ch", group: "Jeden Tag", order: 0 },
  { name: "Uni-Mail (Outlook)", url: "https://outlook.office.com/mail/", group: "Jeden Tag", order: 1 },
  { name: "Online-Services: Belegen, Examen, Noten", url: "https://services.unibas.ch", group: "Jeden Tag", order: 2 },
  { name: "Vorlesungsverzeichnis", url: "https://vorlesungsverzeichnis.unibas.ch", group: "Jeden Tag", order: 3 },
  { name: "Claude", url: "https://claude.ai/new", group: "Jeden Tag", order: 4 },
  // Pharmazie Basel
  { name: "Departement Pharmazeutische Wissenschaften", url: "https://pharma.unibas.ch/de/education/", group: "Pharmazie Basel", order: 10 },
  { name: "Wochenpläne (Stundenpläne)", url: "https://pharma.unibas.ch/de/education/bsc-pharm-wissenschaften/wochenplaene/", group: "Pharmazie Basel", order: 11 },
  { name: "Examensdaten (provisorisch)", url: "https://pharma.unibas.ch/de/education/leistungsueberpruefungen-d/examen-bsc-pharm-wiss/", group: "Pharmazie Basel", order: 12 },
  { name: "Examen Phil.-Nat.: Anmeldung, Abmeldung, Fristen", url: "https://philnat.unibas.ch/de/examen/", group: "Pharmazie Basel", order: 13 },
  { name: "Dokumente: Wegleitung, Studienplan", url: "https://pharma.unibas.ch/de/education/documents/", group: "Pharmazie Basel", order: 14 },
  { name: "Famulatur", url: "https://pharma.unibas.ch/de/education/bsc-pharm-wissenschaften/famulatur/", group: "Pharmazie Basel", order: 15 },
  { name: "Studienkoordination Pharmazie", url: "https://pharma.unibas.ch/de/education/studienkoordination-study-coordination/", group: "Pharmazie Basel", order: 16 },
  { name: "Fachgruppe Pharmazie", url: "https://fg-pharma.unibas.ch/", group: "Pharmazie Basel", order: 17 },
  { name: "Pharma-Blog", url: "https://pharmablog.unibas.ch", group: "Pharmazie Basel", order: 18 },
  // Fachwissen
  { name: "Compendium (Arzneimittel Schweiz)", url: "https://compendium.ch", group: "Fachwissen", order: 20 },
  { name: "Swissmedicinfo (Fachinformationen)", url: "https://www.swissmedicinfo.ch", group: "Fachwissen", order: 21 },
  { name: "PharmaWiki", url: "https://www.pharmawiki.ch", group: "Fachwissen", order: 22 },
  { name: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov", group: "Fachwissen", order: 23 },
  { name: "pharmaSuisse", url: "https://pharmasuisse.org/de", group: "Fachwissen", order: 24 },
  // Bibliothek und Medien
  { name: "Universitätsbibliothek", url: "https://ub.unibas.ch", group: "Bibliothek & Medien", order: 30 },
  { name: "swisscovery Basel (Bücher, E-Books)", url: "https://basel.swisscovery.slsp.ch", group: "Bibliothek & Medien", order: 31 },
  { name: "SWITCHtube (Aufzeichnungen)", url: "https://tube.switch.ch", group: "Bibliothek & Medien", order: 32 },
  { name: "Zoom Uni Basel", url: "https://unibas.zoom.us", group: "Bibliothek & Medien", order: 33 },
  // Rund ums Studium
  { name: "Studium an der Uni Basel", url: "https://www.unibas.ch/de/Studium.html", group: "Rund ums Studium", order: 40 },
  { name: "Belegen: Infos und Fristen", url: "https://www.unibas.ch/de/Studium/Im-Studium/Belegen.html", group: "Rund ums Studium", order: 41 },
  { name: "Studienberatung", url: "https://studienberatung.unibas.ch/de/", group: "Rund ums Studium", order: 42 },
  { name: "IT-Services (WLAN, Drucken, Software)", url: "https://its.unibas.ch/de/", group: "Rund ums Studium", order: 43 },
  { name: "Mensa Universität", url: "https://sv-gastronomie.ch/de/mitarbeiterrestaurants/restaurant-universitaet-basel-mensa", group: "Rund ums Studium", order: 44 },
  { name: "Universitätssport", url: "https://www.unisport.ch", group: "Rund ums Studium", order: 45 },
  { name: "skuba (Studierendenschaft)", url: "https://www.skuba.ch", group: "Rund ums Studium", order: 46 },
];
