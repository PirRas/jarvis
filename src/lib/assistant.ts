// Datentypen für die Assistenten-Funktionen: Aufgaben, Lernzeit, Noten, Markierungen, News-Abos.
// Alle Einträge werden wie der Rest zwischen den Geräten abgeglichen.

type Synced = { updatedAt?: number };

/** Aufgabe (To-do), selbst angelegt oder von Jarvis vorbereitet (preset). */
export type Todo = Synced & {
  id: string;
  title: string;
  note: string;
  due?: string; // "YYYY-MM-DD"; mit Termin gibt es Erinnerungen 7 Tage, 1 Tag vorher und am Tag selbst
  time?: string; // "HH:MM", optional
  category: string; // z. B. "Prüfungen", "Famulatur", "Administratives", "Eigene"
  link?: string;
  done: boolean;
  doneAt?: number;
  preset?: boolean; // von Jarvis vorbereitet
  createdAt: number;
};

/** Eine Lerneinheit (Fokus-Timer oder nachgetragen). */
export type StudySession = Synced & {
  id: string;
  course: string;
  start: number; // ms
  minutes: number;
  kind: "pomodoro" | "frei";
  note?: string;
  createdAt: number;
};

/** Eine Lehrveranstaltung im Studienplan mit Kreditpunkten und (falls vorhanden) Note. */
export type CourseRecord = Synced & {
  id: string;
  module: string; // z. B. "Mathematik für Pharmazeutische Wissenschaften"
  stage: string; // "Grundstudium", "1. Jahr Aufbaustudium", "2. Jahr Aufbaustudium", "Wahlbereich"
  course: string;
  semester: string; // z. B. "1. Sem.", "1. + 2. Sem."
  kp: number;
  assessment: "Examen" | "lehrveranstaltungsbegleitend" | "Pass/Fail";
  status: "offen" | "bestanden" | "nicht bestanden";
  grade?: number; // Schweizer Notenskala 1–6, 4 = genügend
  createdAt: number;
};

/** Kleine Markierung, z. B. "Lektion ist nachbereitet" oder "Hinweis ausgeblendet". */
export type Mark = Synced & {
  id: string; // z. B. "nachbereitet:slot:abo-10380-01-2-1015:2026-10-13"
  createdAt: number;
};

/** News-Abo (RSS/Atom), z. B. ADAM-Neuigkeiten. */
export type NewsFeed = Synced & {
  id: string;
  name: string;
  url: string;
  createdAt: number;
};
