// Lernplan bis zur Prüfung und Nachbereitungs-Wächter.
// Rechnet aus Stundenplan, nachbereiteten Vorlesungen und Karteikarten rückwärts, was bis zu jeder
// Prüfung zu tun ist, und schlägt ein Tagesziel vor. Reine Funktionen, damit sie testbar sind.

import type { Mark } from "./assistant";
import { sameCourse } from "./courses";
import { addDays, DAYMS, dayStart, occurrences, type Occurrence, type PlannerData } from "./planner";
import { isMastered, type CardState } from "./srs";

type LectureLite = { id: string; course: string; title: string; createdAt: number; examTasks: number };

export type Phase = "aufbau" | "vertiefen" | "endspurt" | "pruefungstag";
export const PHASE_LABEL: Record<Phase, string> = {
  aufbau: "Aufbau: laufend nachbereiten",
  vertiefen: "Vertiefen: alle Karten kennenlernen",
  endspurt: "Endspurt: wiederholen und Probeklausuren",
  pruefungstag: "Prüfungstag",
};

export type ExamPlan = {
  exam: Occurrence;
  course: string;
  daysLeft: number; // Kalendertage bis zur Prüfung
  phase: Phase;
  held: number; // Lektionen (Vorlesungen) bisher
  prepared: number; // davon nachbereitet
  remaining: number; // Lektionen bis zur Prüfung
  cards: { total: number; fresh: number; due: number; mastered: number };
  lectureIds: string[];
  examTasks: number;
  daily: { newCards: number; reviews: number };
  readiness: number; // 0–100, grobe Einschätzung
  todo: string[]; // konkrete Vorschläge für heute
};

const isLectureType = (o: Occurrence) => o.kind === "lecture" && /vorlesung|haupt/i.test(o.type);

/**
 * Nachbereitungs-Wächter: vergangene Vorlesungen, für die noch keine Nachbereitung gespeichert ist.
 * Jede gespeicherte Vorlesung deckt die jüngste noch offene Lektion desselben Fachs vor ihrem Speicherzeitpunkt ab.
 */
export function pendingPrep(data: PlannerData, lectures: LectureLite[], marks: Mark[], now = Date.now(), days = 7) {
  const from = addDays(dayStart(now), -days);
  const past = occurrences({ ...data, todos: [] }, addDays(from, -120), now).filter((o) => isLectureType(o) && o.end <= now);
  const done = new Set(marks.filter((m) => m.id.startsWith("nachbereitet:")).map((m) => m.id.slice("nachbereitet:".length)));
  const covered = new Set<string>();
  for (const l of [...lectures].sort((a, b) => a.createdAt - b.createdAt)) {
    const match = past
      .filter((o) => !covered.has(o.key) && o.start <= l.createdAt && sameCourse(o.course, l.course))
      .sort((a, b) => b.start - a.start)[0];
    if (match) covered.add(match.key);
  }
  return past.filter((o) => o.start >= from && !covered.has(o.key) && !done.has(o.key)).sort((a, b) => a.start - b.start);
}

export function examPlans(
  data: PlannerData,
  lectures: LectureLite[],
  cards: CardState[],
  marks: Mark[],
  now = Date.now(),
  horizonDays = 150,
): ExamPlan[] {
  const today = dayStart(now);
  const all = occurrences({ ...data, todos: [] }, addDays(today, -180), addDays(today, horizonDays));
  const exams = all.filter((o) => o.kind === "exam" && o.end > now);
  const done = new Set(marks.filter((m) => m.id.startsWith("nachbereitet:")).map((m) => m.id.slice("nachbereitet:".length)));

  return exams
    .map((exam) => {
      const course = exam.course || exam.title.replace(/^prüfung:?\s*/i, "");
      const lessons = all.filter((o) => isLectureType(o) && sameCourse(o.course, course));
      const held = lessons.filter((o) => o.end <= now && o.start < exam.start).length;
      const remaining = lessons.filter((o) => o.end > now && o.start < exam.start).length;
      const mine = lectures.filter((l) => sameCourse(l.course, course));
      const markedDone = lessons.filter((o) => o.end <= now && done.has(o.key)).length;
      const prepared = Math.min(held, mine.length + markedDone);

      const ids = new Set(mine.map((l) => l.id));
      const deck = cards.filter((c) => ids.has(c.lectureId) && !c.suspended);
      const dayEnd = today + DAYMS;
      const fresh = deck.filter((c) => c.queue === "new").length;
      const due = deck.filter((c) => c.queue !== "new" && c.due <= dayEnd).length;
      const mastered = deck.filter(isMastered).length;

      const daysLeft = Math.max(0, Math.round((dayStart(exam.start) - today) / DAYMS));
      const phase: Phase = daysLeft === 0 ? "pruefungstag" : daysLeft <= 7 ? "endspurt" : daysLeft <= 28 ? "vertiefen" : "aufbau";
      // Neue Karten so verteilen, dass die letzten 5 Tage nur noch fürs Wiederholen bleiben
      const introDays = Math.max(1, daysLeft - 5);
      const newCards = fresh ? Math.ceil(fresh / introDays) : 0;
      const examTasks = mine.reduce((s, l) => s + l.examTasks, 0);

      const todo: string[] = [];
      const missing = held - prepared;
      if (missing > 0) todo.push(`${missing} ${missing === 1 ? "Lektion" : "Lektionen"} nachbereiten`);
      if (phase !== "pruefungstag") {
        if (newCards) todo.push(`${newCards} neue Karten`);
        if (due) todo.push(`${due} Wiederholungen`);
        if (phase === "endspurt" && examTasks) todo.push(`Probeklausur: ${Math.min(examTasks, 3)} Klausuraufgaben lösen`);
        if (phase === "endspurt" && !deck.length && !mine.length) todo.push("Unterlagen zusammentragen und Altklausuren besorgen");
      }

      // Bereitschaft: Nachbereitung (40 %), sichere Karten (60 %); ohne Karten zählt nur die Nachbereitung
      const prepShare = held ? prepared / held : mine.length ? 1 : 0;
      const cardShare = deck.length ? mastered / deck.length : null;
      const readiness = Math.round(100 * (cardShare === null ? prepShare * 0.5 : prepShare * 0.4 + cardShare * 0.6));

      return {
        exam,
        course,
        daysLeft,
        phase,
        held,
        prepared,
        remaining,
        cards: { total: deck.length, fresh, due, mastered },
        lectureIds: mine.map((l) => l.id),
        examTasks,
        daily: { newCards, reviews: due },
        readiness,
        todo,
      };
    })
    .sort((a, b) => a.exam.start - b.exam.start);
}

/** Wochenrückblick: Montag bis jetzt, plus Vorschau auf die nächsten 7 Tage. */
export function weekReview(data: PlannerData, lectures: LectureLite[], marks: Mark[], now = Date.now()) {
  const d = new Date(dayStart(now));
  const monday = addDays(d.getTime(), -((d.getDay() + 6) % 7));
  const week = occurrences({ ...data, todos: [] }, monday, now).filter((o) => isLectureType(o) && o.end <= now);
  const pending = pendingPrep(data, lectures, marks, now, Math.max(1, Math.round((now - monday) / DAYMS) + 1));
  const next = occurrences(data, now, addDays(dayStart(now), 8)).filter((o) => o.kind !== "lecture");
  const nextLectures = occurrences(data, now, addDays(dayStart(now), 8)).filter((o) => o.kind === "lecture").length;
  return {
    held: week.length,
    prepared: week.length - pending.filter((o) => o.start >= monday).length,
    newLectures: lectures.filter((l) => l.createdAt >= monday).length,
    upcoming: next,
    nextLectures,
  };
}
