// Aufgaben: von Jarvis vorbereitete Pflichten rund ums Studium (keine Nachbereitung, die läuft separat)
// und Hilfsfunktionen zum Sortieren. Vorbereitete Aufgaben haben feste IDs, damit beide Geräte dieselben anlegen.

import type { Todo } from "./assistant";
import { DAYMS, dayStart, parseIsoDate } from "./planner";
import { UNI_DEADLINES } from "./uniDates";

export const TODO_CATEGORIES = ["Prüfungen", "Administratives", "Famulatur", "Studium", "Eigene"];

/** Merkt sich (abgeglichen), dass die Vorlagen schon angelegt wurden; gelöschte kommen so nicht zurück. */
export const PRESETS_MARK = "seeded:todos-v1";

const PHARMASUISSE_FAMULATUR = "https://pharmasuisse.org/de/beruf-und-bildung/beruf-apothekerin/famulatur";
const FAMULATUR_PAGE = "https://pharma.unibas.ch/de/education/bsc-pharm-wissenschaften/famulatur/";

export function presetTodos(now = Date.now()): Todo[] {
  const base = { done: false, preset: true, createdAt: now };
  const uni = (id: string) => UNI_DEADLINES.find((d) => d.id === id)!;
  const fromUni = (id: string, category: string): Todo => {
    const d = uni(id);
    return {
      ...base,
      id: `preset-${id}`,
      title: d.estimated ? `${d.title} (Frist geschätzt)` : d.title,
      note: d.note,
      due: d.date,
      category,
      link: d.link,
    };
  };

  return [
    fromUni("hs26-examensanmeldung", "Prüfungen"),
    {
      ...base,
      id: "preset-hs26-chemie-termin",
      title: "Prüfungstermin «Einführung in die Chemie» prüfen",
      note: "Laut provisorischen Examensdaten des Departements am 19.01.2027; im Stundenplan-Abo steht er noch nicht. Bei der Examensanmeldung kontrollieren.",
      due: "2026-11-09",
      category: "Prüfungen",
      link: "https://pharma.unibas.ch/de/education/leistungsueberpruefungen-d/examen-bsc-pharm-wiss/",
    },
    {
      ...base,
      id: "preset-hs26-abmeldefristen",
      title: "Abmeldefristen der Prüfungen kennen",
      note: "Abmeldung ohne Angabe von Gründen ist nur schriftlich und bis drei Wochen vor dem jeweiligen Examen möglich. Danach nur mit triftigem Grund (z. B. Arztzeugnis innert 5 Tagen nach dem Prüfungstermin beim Studiendekanat).",
      category: "Prüfungen",
      link: "https://philnat.unibas.ch/de/examen/",
    },
    fromUni("fs27-rueckmeldung", "Administratives"),
    fromUni("fs27-semestergebuehr", "Administratives"),
    fromUni("fs27-belegen", "Administratives"),
    {
      ...base,
      id: "preset-fs27-stundenplan-abo",
      title: "Stundenplan-Abo fürs FS27 prüfen",
      note: "Vorlesungsbeginn ist am 22.02.2027. Prüfen, ob Jarvis die neuen Kurse zeigt; sonst in den Online-Services die neue Abo-Adresse kopieren und auf der Stundenplan-Seite unter «Neuer Link» einsetzen.",
      due: "2027-02-15",
      category: "Administratives",
      link: "https://services.unibas.ch",
    },
    {
      ...base,
      id: "preset-famulatur-planen",
      title: "Famulatur planen: Apotheke suchen",
      note: "Zweiwöchiges Praktikum, obligatorisch bis zum Bachelorabschluss. Mindestens eine Woche in einer öffentlichen Offizinapotheke, die zweite auch in einer Spitalapotheke möglich. pharmaSuisse empfiehlt ab dem 2. Studienjahr; Apothekenverzeichnis, Formulare und Leitfaden bei pharmaSuisse. Wer Pharma-Assistent/in EFZ ist, muss keine Famulatur machen.",
      category: "Famulatur",
      link: PHARMASUISSE_FAMULATUR,
    },
    {
      ...base,
      id: "preset-famulatur-absolvieren",
      title: "Famulatur absolvieren (2 Wochen)",
      note: "Termin eintragen, sobald die Apotheke zugesagt hat; dann erinnert dich Jarvis rechtzeitig.",
      category: "Famulatur",
      link: FAMULATUR_PAGE,
    },
    {
      ...base,
      id: "preset-famulatur-bestaetigung",
      title: "Famulaturbestätigung beim Studiendekanat abgeben",
      note: "Nachweis für das Bestehen des Aufbaustudiums. Abgabe beim Studiendekanat der Phil.-Nat. Fakultät.",
      category: "Famulatur",
      link: "https://philnat.unibas.ch/de/studium/studiendekanat/",
    },
  ];
}

export type TodoGroup = { key: string; label: string; items: Todo[] };

/** Gruppiert offene Aufgaben nach Dringlichkeit, erledigte zuletzt. */
export function groupTodos(todos: Todo[], now = Date.now()): TodoGroup[] {
  const today = dayStart(now);
  const open = todos.filter((t) => !t.done);
  const dueDay = (t: Todo) => (t.due ? parseIsoDate(t.due) : Infinity);
  const sorted = [...open].sort((a, b) => dueDay(a) - dueDay(b) || a.title.localeCompare(b.title));
  const groups: TodoGroup[] = [
    { key: "overdue", label: "Überfällig", items: sorted.filter((t) => dueDay(t) < today) },
    { key: "week", label: "Nächste 7 Tage", items: sorted.filter((t) => dueDay(t) >= today && dueDay(t) < today + 7 * DAYMS) },
    { key: "later", label: "Später", items: sorted.filter((t) => dueDay(t) >= today + 7 * DAYMS && dueDay(t) < Infinity) },
    { key: "nodate", label: "Ohne Termin", items: sorted.filter((t) => dueDay(t) === Infinity) },
    {
      key: "done",
      label: "Erledigt",
      items: todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    },
  ];
  return groups.filter((g) => g.items.length);
}

/** "heute", "morgen", "in 5 Tagen", "seit 2 Tagen" */
export function dueLabel(due: string, now = Date.now()) {
  const diff = Math.round((parseIsoDate(due) - dayStart(now)) / DAYMS);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === -1) return "seit gestern";
  if (diff < 0) return `seit ${-diff} Tagen`;
  return `in ${diff} Tagen`;
}
