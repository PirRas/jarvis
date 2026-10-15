// Vorlage für das 1. Semester Bachelor Pharmazeutische Wissenschaften, Uni Basel, HS 2026.
// Quellen (provisorisch, Stand Oktober 2026):
// - Wochenplan: https://pharma.unibas.ch/fileadmin/user_upload/pharma/Teaching/Wochenplaene/HS26/1sem_bsc_hs26.pdf (aktualisiert 17.08.2026)
// - Examensdaten: https://pharma.unibas.ch/fileadmin/user_upload/pharma/Teaching/Leistungsueberpruefungen/Termine/Prov_Examensdaten_HS26.pdf (aktualisiert 29.09.2026)
// - Fristen: https://philnat.unibas.ch/de/examen/
// Räume stehen bewusst nicht in der Vorlage: Sie werden vor jeder Lektion live im Vorlesungsverzeichnis nachgeschaut.

import type { CalEvent, Slot } from "./planner";

export const TEMPLATE_NAME = "Pharmazeutische Wissenschaften, 1. Semester, HS 2026";
export const TEMPLATE_SOURCE = "https://pharma.unibas.ch/de/education/bsc-pharm-wissenschaften/wochenplaene/";

const SEM = { from: "2026-09-14", until: "2026-12-18", skip: ["2026-11-27"] }; // 27.11.: Dies Academicus

export type SlotTpl = Omit<Slot, "id" | "createdAt" | "from" | "until" | "skip" | "code"> & {
  code: string;
  from?: string;
  group?: string; // Wahl zwischen Übungsgruppen
};

export const MATH_GROUPS = ["1. Zeitfenster", "2. Zeitfenster"];

const PHARMA_SLOTS: SlotTpl[] = [
  { code: "10370", course: "Einführung in die Pharmazeutischen Wissenschaften", type: "Vorlesung", weekday: 1, start: "08:15", end: "10:00", room: "" },
  { code: "10380", course: "Einführung in die Chemie", type: "Vorlesung", weekday: 1, start: "10:15", end: "12:00", room: "", from: "2026-09-15" },
  { code: "10551", course: "Mathematik I", type: "Übung (1. Zeitfenster)", weekday: 1, start: "12:00", end: "15:00", room: "", from: "2026-09-21", group: "1. Zeitfenster" },
  { code: "10551", course: "Mathematik I", type: "Übung (2. Zeitfenster)", weekday: 1, start: "16:15", end: "18:00", room: "", from: "2026-09-21", group: "2. Zeitfenster" },
  { code: "10512", course: "Einführung in die Physik I", type: "Übung", weekday: 2, start: "08:15", end: "10:00", room: "", from: "2026-09-15" },
  { code: "10380", course: "Einführung in die Chemie", type: "Vorlesung", weekday: 2, start: "10:15", end: "12:00", room: "" },
  { code: "14301", course: "Organisation und Systematik der Arznei- und Giftpflanzen", type: "Vorlesung", weekday: 2, start: "13:15", end: "14:15", room: "" },
  { code: "10398", course: "Anatomie", type: "Vorlesung", weekday: 2, start: "14:15", end: "16:00", room: "" },
  { code: "38232", course: "Analytische Chemie I: Quantitative Analytik", type: "Vorlesung", weekday: 3, start: "08:15", end: "09:00", room: "" },
  { code: "10509", course: "Vielfalt und Ökologie der Mikroorganismen", type: "Vorlesung", weekday: 3, start: "09:15", end: "10:00", room: "" },
  { code: "10380", course: "Einführung in die Chemie", type: "Vorlesung", weekday: 3, start: "10:15", end: "12:00", room: "" },
  { code: "10416", course: "Physiologie", type: "Vorlesung", weekday: 3, start: "13:15", end: "15:00", room: "" },
  { code: "10551", course: "Mathematik I", type: "Vorlesung", weekday: 4, start: "08:15", end: "10:00", room: "" },
  { code: "10512", course: "Einführung in die Physik I", type: "Vorlesung", weekday: 4, start: "10:15", end: "12:00", room: "" },
  { code: "10551", course: "Mathematik I", type: "Übung (2. Zeitfenster)", weekday: 4, start: "13:15", end: "16:00", room: "", from: "2026-09-24", group: "2. Zeitfenster" },
  { code: "10551", course: "Mathematik I", type: "Vorlesung", weekday: 5, start: "08:15", end: "10:00", room: "" },
  { code: "10512", course: "Einführung in die Physik I", type: "Vorlesung", weekday: 5, start: "10:15", end: "12:00", room: "" },
];

/** Stundenplan aus der Vorlage; `group` wählt die Mathe-Übungsgruppe (null = keine Übung eintragen). */
export function templateSlots(group: string | null): Slot[] {
  const now = Date.now();
  return PHARMA_SLOTS.filter((s) => !s.group || s.group === group).map((s) => ({
    id: `tpl-hs26-${s.code}-${s.weekday}-${s.start.replace(":", "")}`,
    course: s.course,
    code: s.code,
    type: s.type,
    weekday: s.weekday,
    start: s.start,
    end: s.end,
    room: s.room,
    from: s.from ?? SEM.from,
    until: SEM.until,
    skip: SEM.skip,
    createdAt: now,
  }));
}

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

const EXAMS: [string, string, number][] = [
  ["10509", "Vielfalt und Ökologie der Mikroorganismen", day(2026, 12, 16)],
  ["10512", "Einführung in die Physik I", day(2027, 1, 6)],
  ["10551", "Mathematik I", day(2027, 1, 14)],
  ["10380", "Einführung in die Chemie", day(2027, 1, 19)],
];

export function templateEvents(): CalEvent[] {
  const now = Date.now();
  const base = { end: null, allDay: true, source: "manual" as const, createdAt: now };
  return [
    {
      ...base,
      id: "tpl-hs26-anmeldung-start",
      title: "Examensanmeldung HS26 öffnet",
      course: "",
      kind: "deadline",
      start: day(2026, 10, 26),
      location: "services.unibas.ch",
      note: "In den Online-Services den Service «Examensanmeldung Hauptvorlesungen (Phil.-Nat.)» wählen. Anmeldefrist 26.10.–09.11.2026.",
    },
    {
      ...base,
      id: "tpl-hs26-anmeldung-ende",
      title: "Letzter Tag: Examensanmeldung HS26",
      course: "",
      kind: "deadline",
      start: day(2026, 11, 9),
      location: "services.unibas.ch",
      note: "Ohne Anmeldung keine Prüfung. Für einen Erstversuch braucht es eine aktuelle Belegung.",
    },
    ...EXAMS.map(([code, course, start]) => ({
      ...base,
      id: `tpl-hs26-exam-${code}`,
      title: `Prüfung ${course}`,
      course,
      kind: "exam" as const,
      start,
      location: "",
      note: `Examen ${code}. Provisorischer Termin laut Departement (Stand 29.09.2026), Uhrzeit und Raum folgen. Abmeldung ohne Angabe von Gründen nur bis drei Wochen vorher und nur schriftlich.`,
    })),
  ];
}
