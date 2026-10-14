// Jarvis: wertet Stundenplan, Termine und Lernstand aus und schlägt vor, was heute wichtig ist.

import { z } from "zod";
import { sameCourse } from "./courses";
import type { Lecture } from "./db";
import {
  addDays,
  dayStart,
  DAYMS,
  fmtShortDay,
  fmtTime,
  HOUR,
  isoDate,
  KIND_LABEL,
  previewId,
  relDay,
  WEEKDAYS,
  type LessonPreview,
  type Occurrence,
} from "./planner";
import { countDue, isMastered, type CardState } from "./srs";

export type Tip = {
  id: string;
  tone: "urgent" | "normal" | "calm";
  text: string;
  href?: string;
  action?: string;
};

export function greeting(now = Date.now()) {
  const h = new Date(now).getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
}

/** Lernstand für ein Fach: Anteil sicherer Karten und fällige Karten. */
export function readiness(course: string, lectures: Lecture[], cards: CardState[], newLeft: number) {
  const ids = new Set(lectures.filter((l) => course && sameCourse(l.course, course)).map((l) => l.id));
  const deck = cards.filter((c) => ids.has(c.lectureId) && !c.suspended);
  const mastered = deck.filter(isMastered).length;
  const due = countDue(deck, newLeft);
  return {
    lectures: ids.size,
    cards: deck.length,
    pct: deck.length ? Math.round((mastered / deck.length) * 100) : 0,
    due: due.new + due.learning + due.review,
    firstLectureId: [...ids][0],
  };
}

/** Neueste Nachbereitung zu einem Fach (für "Letztes Mal in …"). */
export function latestLecture(course: string, lectures: Lecture[]) {
  return lectures.filter((l) => course && sameCourse(l.course, course)).sort((a, b) => b.createdAt - a.createdAt)[0];
}

export function tips(args: {
  list: Occurrence[]; // Zeitleiste von vor 4 Tagen bis in 60 Tagen
  lectures: Lecture[];
  cards: CardState[];
  previews: LessonPreview[];
  newLeft: number;
  now?: number;
}): Tip[] {
  const { list, lectures, cards, previews, newLeft } = args;
  const now = args.now ?? Date.now();
  const out: Tip[] = [];

  // Fristen in den nächsten 14 Tagen
  for (const o of list.filter((o) => o.kind === "deadline" && o.end > now && o.start < now + 14 * DAYMS)) {
    const days = Math.round((dayStart(o.start) - dayStart(now)) / DAYMS);
    out.push({
      id: `deadline:${o.key}`,
      tone: days <= 3 ? "urgent" : "normal",
      text: `${o.title}: ${relDay(o.start, now)} (${fmtShortDay(o.start)}).`,
      href: o.location.includes(".") ? `https://${o.location.replace(/^https?:\/\//, "")}` : "/kalender",
      action: "Öffnen",
    });
  }

  // Prüfungen in den nächsten 4 Wochen mit Lernstand
  for (const o of list.filter((o) => o.kind === "exam" && o.end > now && o.start < now + 28 * DAYMS)) {
    const r = readiness(o.course, lectures, cards, newLeft);
    const when = relDay(o.start, now);
    const text = r.cards
      ? `${KIND_LABEL.exam} ${o.course || o.title} ${when}: ${r.pct} % der Karten sitzen, ${r.due} heute fällig.`
      : `${KIND_LABEL.exam} ${o.course || o.title} ${when}. Noch keine Nachbereitung zu diesem Fach: Lade die Folien hoch, dann bekommst du Karten und Quiz.`;
    out.push({
      id: `exam:${o.key}`,
      tone: o.start - now < 10 * DAYMS ? "urgent" : "normal",
      text,
      href: r.cards ? "/lernen" : "/vorlesungen",
      action: r.cards ? "Lernen" : "Hinzufügen",
    });
  }

  // Fällige Karten
  const due = countDue(cards, newLeft);
  const dueTotal = due.learning + due.review;
  if (dueTotal > 0)
    out.push({
      id: "due",
      tone: dueTotal > 60 ? "urgent" : "calm",
      text: `${dueTotal} Karten sind zur Wiederholung fällig${due.new ? `, dazu ${due.new} neue` : ""}.`,
      href: "/lernen",
      action: "Lernen",
    });

  // Nachbereitung fehlt: Lektion in den letzten 4 Tagen, aber keine Nachbereitung danach hochgeladen
  const missing = new Map<string, Occurrence>();
  for (const o of list) {
    if (o.kind !== "lecture" || o.end > now || o.start < now - 4 * DAYMS) continue;
    if (/übung|praktikum|tutorat/i.test(o.type)) continue;
    const done = lectures.some((l) => sameCourse(l.course, o.course) && l.createdAt >= o.start - 12 * HOUR);
    if (!done) missing.set(o.course, o);
  }
  for (const o of missing.values()) {
    out.push({
      id: `missing:${o.key}`,
      tone: "normal",
      text: `Nachbereitung für ${o.course} (${WEEKDAYS[(new Date(o.start).getDay() + 6) % 7]}) fehlt noch.`,
      href: "/vorlesungen",
      action: "Folien hinzufügen",
    });
  }

  // Lektionen heute/morgen ohne Vorschau
  const soon = list.filter(
    (o) => o.kind === "lecture" && o.start > now && o.start < dayStart(addDays(now, 2)) && !/übung/i.test(o.type),
  );
  const noPreview = soon.filter((o) => !previews.some((p) => p.id === previewId(o.course, o.start)));
  if (noPreview.length)
    out.push({
      id: "previews",
      tone: "calm",
      text: `Vorschau möglich für ${[...new Set(noPreview.map((o) => o.course))].slice(0, 3).join(", ")}: Folien vorab hochladen, dann siehst du, was drankommt.`,
      href: "#als-naechstes",
      action: "Ansehen",
    });

  const rank = { urgent: 0, normal: 1, calm: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

// ---------- Prompts für claude.ai ----------

export function previewPrompt(course: string, date: number, slideText: string) {
  return `Ich studiere Pharmazeutische Wissenschaften an der Uni Basel. Unten steht der Text der Folien für meine nächste Lektion „${course}“ am ${fmtShortDay(date)}.

Schreib mir eine kurze Vorschau (max. 180 Wörter, Markdown):
1. **Worum geht es?** 2–3 Sätze.
2. **Die wichtigsten Themen** als 4–7 Stichpunkte.
3. **Darauf achten:** 1–2 Begriffe oder Konzepte, die vermutlich schwierig oder prüfungsrelevant sind.
4. **Vorwissen auffrischen:** was ich vorher kurz anschauen sollte.

Antworte nur mit der Vorschau, ohne Einleitung.

Folientext:
${slideText}`;
}

export function askJarvisPrompt(args: { list: Occurrence[]; tips: Tip[]; now?: number }) {
  const now = args.now ?? Date.now();
  const week = args.list
    .filter((o) => o.end > now && o.start < now + 7 * DAYMS)
    .map((o) => `- ${fmtShortDay(o.start)} ${o.allDay ? "ganztägig" : fmtTime(o.start)}: ${o.title}${o.type ? ` (${o.type})` : ""}`)
    .join("\n");
  const exams = args.list
    .filter((o) => o.kind === "exam" && o.end > now)
    .map((o) => `- ${isoDate(o.start)}: ${o.title}`)
    .join("\n");
  return `Du bist Jarvis, mein persönlicher Studienassistent. Ich studiere im 1. Semester Pharmazeutische Wissenschaften an der Universität Basel. Heute ist ${fmtShortDay(now)}.

Meine nächsten 7 Tage:
${week || "- keine Einträge"}

Prüfungen:
${exams || "- keine eingetragen"}

Hinweise aus meinem Cockpit:
${args.tips.map((t) => `- ${t.text}`).join("\n") || "- keine"}

Hilf mir, die Woche zu planen: Erstelle einen realistischen Lernplan (Zeitblöcke zwischen den Lehrveranstaltungen), priorisiere nach Prüfungsnähe und sag mir, was ich heute als Erstes tun sollte.`;
}

// Stundenplan per Foto/PDF über Claude einlesen
export const TimetableSchema = z.object({
  slots: z.array(
    z.object({
      course: z.string().describe("Name der Lehrveranstaltung"),
      code: z.string().describe("Nummer im Vorlesungsverzeichnis (z. B. 10380), leer wenn unbekannt"),
      type: z.string().describe("Vorlesung, Übung, Seminar, Praktikum …"),
      weekday: z.number().int().min(1).max(7).describe("1 = Montag … 7 = Sonntag"),
      start: z.string().describe("Beginn HH:MM"),
      end: z.string().describe("Ende HH:MM"),
      room: z.string().describe("Raum, leer wenn unbekannt"),
    }),
  ),
});

export const TIMETABLE_PROMPT = `Im Anhang ist mein Stundenplan (Bild oder PDF). Lies alle wöchentlichen Lehrveranstaltungen aus.
Antworte ausschließlich mit einem JSON-Objekt in einem Codeblock, genau in diesem Aufbau:

\`\`\`json
{ "slots": [ { "course": "Einführung in die Chemie", "code": "10380", "type": "Vorlesung", "weekday": 1, "start": "10:15", "end": "12:00", "room": "" } ] }
\`\`\`

Regeln: weekday 1 = Montag bis 7 = Sonntag. Zeiten als HH:MM. Ein Eintrag pro Wochentag und Zeitblock. Nummern (5-stellig) übernehmen, wenn sie dastehen.`;
