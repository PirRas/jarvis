// Offizielle Daten der Universität Basel (Stand 14.10.2026).
// Quellen:
// - Semesterdaten: https://www.unibas.ch/de/Studium/Im-Studium/Termine-Fristen/Semesterdaten.html
// - Vorlesungsfrei: https://www.unibas.ch/de/Studium/Im-Studium/Termine-Fristen/Vorlesungsfrei.html
// - Rückmeldung/Belegen: https://www.unibas.ch/de/Studium/Im-Studium/Termine-Fristen/Fristen/Rueckmeldung.html
// - Examen Phil.-Nat.: https://philnat.unibas.ch/de/examen/
// Daten mit `estimated: true` sind noch nicht veröffentlicht und aus den Vorjahren abgeleitet.

export type Semester = {
  id: string; // "HS26"
  name: string;
  from: string; // akademisches Semester
  until: string;
  lecturesFrom: string;
  lecturesUntil: string;
};

export const SEMESTERS: Semester[] = [
  { id: "HS26", name: "Herbstsemester 2026", from: "2026-08-01", until: "2027-01-31", lecturesFrom: "2026-09-14", lecturesUntil: "2026-12-18" },
  { id: "FS27", name: "Frühjahrsemester 2027", from: "2027-02-01", until: "2027-07-31", lecturesFrom: "2027-02-22", lecturesUntil: "2027-06-04" },
  { id: "HS27", name: "Herbstsemester 2027", from: "2027-08-01", until: "2028-01-31", lecturesFrom: "2027-09-20", lecturesUntil: "2027-12-23" },
];

/** Vorlesungsfreie Tage (an diesen Tagen fallen Lehrveranstaltungen aus). */
export const LECTURE_FREE: { from: string; until: string; name: string }[] = [
  { from: "2026-11-27", until: "2026-11-27", name: "Dies Academicus" },
  { from: "2026-12-21", until: "2027-01-01", name: "Weihnachten" },
  { from: "2027-03-25", until: "2027-04-02", name: "Ostern" },
  { from: "2027-05-06", until: "2027-05-06", name: "Auffahrt" },
  { from: "2027-05-07", until: "2027-05-07", name: "Freitag nach Auffahrt" },
  { from: "2027-05-17", until: "2027-05-17", name: "Pfingstmontag" },
  { from: "2027-12-27", until: "2027-12-31", name: "Weihnachten" },
];

/** Ist dieser Tag (YYYY-MM-DD) vorlesungsfrei? Gibt den Anlass zurück. */
export function lectureFree(iso: string) {
  return LECTURE_FREE.find((f) => iso >= f.from && iso <= f.until)?.name ?? null;
}

export type UniDeadline = {
  id: string;
  title: string;
  date: string; // Stichtag (YYYY-MM-DD)
  from?: string; // Beginn des Zeitraums
  note: string;
  link: string;
  estimated?: boolean;
};

export const UNI_DEADLINES: UniDeadline[] = [
  {
    id: "hs26-examensanmeldung",
    title: "Examensanmeldung HS26",
    from: "2026-10-26",
    date: "2026-11-09",
    note: "In den Online-Services den Service «Examensanmeldung Hauptvorlesungen (Phil.-Nat.)» wählen. Ohne Anmeldung keine Prüfung. Abmeldung ohne Angabe von Gründen nur schriftlich und bis drei Wochen vor dem Examen.",
    link: "https://services.unibas.ch",
  },
  {
    id: "fs27-rueckmeldung",
    title: "Rückmeldung für das Frühjahrsemester 2027",
    from: "2026-12-01",
    date: "2027-01-31",
    note: "Rückmeldung über die Online-Services; danach kommt die Semesterrechnung per E-Mail. Genaue Frist noch nicht veröffentlicht. Fürs HS26 lief sie bis 17.08. (mit Nachgebühr CHF 50.– bis 14.09.); Jarvis erinnert vorsichtshalber bis Ende Januar. Bitte auf der Fristen-Seite der Uni prüfen.",
    link: "https://www.unibas.ch/de/Studium/Im-Studium/Termine-Fristen/Fristen/Rueckmeldung.html",
    estimated: true,
  },
  {
    id: "fs27-semestergebuehr",
    title: "Semestergebühr FS27 bezahlen",
    date: "2027-02-01",
    note: "Rechnung kommt nach der Rückmeldung per E-Mail. Frist geschätzt (im HS26 war es der 01.08.) – bitte auf der Rechnung prüfen.",
    link: "https://www.unibas.ch/de/Studium/Im-Studium/Dokumente-und-Verifikation/Semesterrechnung.html",
    estimated: true,
  },
  {
    id: "fs27-belegen",
    title: "Lehrveranstaltungen FS27 belegen",
    from: "2027-01-01",
    date: "2027-03-15",
    note: "Alle besuchten Lehrveranstaltungen müssen belegt sein (Voraussetzung für Prüfungen). Frist geschätzt (im HS26: 01.08.–12.10.) – bitte im Vorlesungsverzeichnis bzw. auf der Fristen-Seite prüfen.",
    link: "https://www.unibas.ch/de/Studium/Im-Studium/Termine-Fristen/Fristen/Belegen-von-Lehrveranstaltungen.html",
    estimated: true,
  },
];
