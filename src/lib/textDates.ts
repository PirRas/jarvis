// Findet Termine in kopiertem Text, z. B. einer Prüfungsankündigung aus ADAM oder der Prüfungsübersicht in MOnA.
// Erkennt "15.01.2027", "15.1.27", "15. Januar 2027", "Fr, 15. Jan." sowie Uhrzeiten wie "14:15", "14.15 Uhr", "14–16 Uhr", "12 Uhr".

import { guessKind, type EventKind } from "./planner";

export type FoundDate = {
  title: string;
  start: number;
  end: number | null;
  allDay: boolean;
  kind: EventKind;
  context: string;
};

const MONTHS: Record<string, number> = {
  jan: 1, januar: 1, jänner: 1, january: 1,
  feb: 2, februar: 2, february: 2,
  mär: 3, mar: 3, märz: 3, maerz: 3, march: 3,
  apr: 4, april: 4,
  mai: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, november: 11,
  dez: 12, dec: 12, dezember: 12, december: 12,
};

const NUMERIC = /\b(\d{1,2})\.\s?(\d{1,2})\.(\d{2,4})?(?!\d)/g;
const WORDY = /\b(\d{1,2})\.?\s+(jan(?:uar)?|jänner|feb(?:ruar)?|mär(?:z)?|maerz|mar(?:ch)?|apr(?:il)?|mai|may|jun(?:i|e)?|jul(?:i|y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)\.?(?:\s+(\d{4}))?/gi;
const TIME = /\b(\d{1,2})[:.](\d{2})(?:\s*(?:uhr|h))?(?:\s*(?:-|–|—|bis)\s*(\d{1,2})(?:[:.](\d{2}))?)?|\b(\d{1,2})\s*(?:-|–|bis)\s*(\d{1,2})\s*uhr|\b(\d{1,2})\s*uhr\b/gi;

function year(y: string | undefined, month: number, day: number, now: number) {
  if (y) return y.length === 2 ? 2000 + Number(y) : Number(y);
  // Ohne Jahr: das nächste Vorkommen ab heute (minus ein paar Tage Kulanz)
  const n = new Date(now);
  const thisYear = new Date(n.getFullYear(), month - 1, day).getTime();
  return thisYear < now - 7 * 86_400_000 ? n.getFullYear() + 1 : n.getFullYear();
}

function cleanTitle(line: string) {
  return line
    .replace(NUMERIC, " ")
    .replace(WORDY, " ")
    .replace(TIME, " ")
    .replace(/\b(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b\.?,?/gi, " ")
    .replace(/\buhr\b/gi, " ")
    .replace(/\.{3,}|…+/g, " ") // Punktreihen wie in "Mathematik I ........ Do, 14.1.2027"
    .replace(/\(\s*\)/g, " ")
    // Füllwörter nur dort entfernen, wo Datum oder Uhrzeit standen ("am", "von … bis"), nicht mitten im Titel
    .replace(/\b(am|um|von|bis|ab)(\s+(am|um|von|bis|ab)\b)+/gi, " ")
    .replace(/(\s+\b(am|um|von|bis|ab)\b)+[\s|•·,;:–—.-]*$/gi, "")
    .replace(/^[\s|•·,;:–—-]*(\b(am|um|von|bis|ab)\b\s+)+/gi, "")
    .replace(/[\s|•·,;:–—.-]+$/g, "")
    .replace(/^[\s|•·,;:–—-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    // Tabellenzeilen ("Mathe I | Klausur | | Kollegienhaus"): leere Spalten weglassen
    .split(/\s*\|\s*/)
    .filter((part) => /\w/.test(part))
    .join(" · ");
}

/** Sucht alle Daten im Text; pro Fundstelle die Zeile (bzw. Nachbarzeile) als Titel und Kontext. */
export function findDates(text: string, now = Date.now()): FoundDate[] {
  // Absätze mit mehreren Daten (z. B. aus Mails) in Sätze teilen, sonst teilen sich alle Termine Uhrzeit, Titel und Art.
  // shortcut: Satzende = kleingeschriebenes Wort + Punkt vor Grossbuchstabe; Sätze, die auf ein Nomen enden, bleiben zusammen
  const lines = text
    .split(/\r?\n/)
    .flatMap((l) => ((l.match(NUMERIC)?.length ?? 0) + (l.match(WORDY)?.length ?? 0) > 1 ? l.split(/(?<=\s[a-zäöüß]+[.!?])\s+(?=[A-ZÄÖÜ])/) : [l]))
    .map((l) => l.trim());
  const out: FoundDate[] = [];
  const seen = new Set<string>();
  const examList = guessKind(lines.filter(Boolean).slice(0, 4).join(" ")) === "exam";

  lines.forEach((line, i) => {
    if (!line) return;
    const hits: { day: number; month: number; y?: string; index: number }[] = [];
    for (const m of line.matchAll(NUMERIC)) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) hits.push({ day, month, y: m[3], index: m.index ?? 0 });
    }
    for (const m of line.matchAll(WORDY)) {
      const month = MONTHS[m[2].toLowerCase().replace(/\.$/, "")] ?? MONTHS[m[2].toLowerCase().slice(0, 3)];
      const day = Number(m[1]);
      if (month && day >= 1 && day <= 31) hits.push({ day, month, y: m[3], index: m.index ?? 0 });
    }
    if (!hits.length) return;
    hits.sort((a, b) => a.index - b.index);

    // Daten vorher (längengleich) ausblenden, sonst wird "15.01.2027" als Uhrzeit 15:01 gelesen
    const blank = (m: string) => " ".repeat(m.length);
    const times = [...line.replace(NUMERIC, blank).replace(WORDY, blank).matchAll(TIME)];
    const prev = lines[i - 1] ?? "";
    const next = lines[i + 1] ?? "";
    let title = cleanTitle(line);
    const prevHasDate = new RegExp(NUMERIC.source).test(prev) || new RegExp(WORDY.source, "i").test(prev);
    const prevIsHeading = prev.length > 3 && prev.length <= 70 && !prevHasDate && !/[.:]$/.test(prev);
    // Steht in der Zeile nur das Datum, ist der Titel meist in der Zeile davor.
    // Ist die Zeile ein ganzer Satz ("Die Prüfung findet … statt."), ist eine Überschrift darüber der bessere Titel.
    if (title.length < 4) title = cleanTitle(prev) || cleanTitle(next) || "Termin";
    else if (prevIsHeading && /\.$/.test(title) && title.split(" ").length >= 6) title = cleanTitle(prev);
    const context = [prev, line, next].filter(Boolean).join(" · ");

    hits.forEach((h, k) => {
      const y = year(h.y, h.month, h.day, now);
      let start = new Date(y, h.month - 1, h.day).getTime();
      let end: number | null = null;
      let allDay = true;
      // Uhrzeit zwischen diesem und dem nächsten Datum, sonst die erste der Zeile ("14.1. – 15.1., 9:00")
      const until = hits[k + 1]?.index ?? Infinity;
      const t = times.find((x) => x.index >= h.index && x.index < until) ?? times[0];
      if (t) {
        if (t[1] !== undefined) {
          start = new Date(y, h.month - 1, h.day, Number(t[1]), Number(t[2])).getTime();
          if (t[3] !== undefined) end = new Date(y, h.month - 1, h.day, Number(t[3]), Number(t[4] ?? 0)).getTime();
        } else if (t[5] !== undefined) {
          start = new Date(y, h.month - 1, h.day, Number(t[5])).getTime();
          end = new Date(y, h.month - 1, h.day, Number(t[6])).getTime();
        } else {
          start = new Date(y, h.month - 1, h.day, Number(t[7])).getTime();
        }
        allDay = false;
        if (end !== null && end <= start) end = null;
      }
      const key = `${start}|${title}`;
      if (seen.has(key)) return;
      seen.add(key);
      // Art zuerst aus der eigenen Zeile, sonst aus dem Umfeld
      const own = guessKind(`${line} ${title}`);
      const near = guessKind(context);
      // In einer Examensliste ("provisorische Examensdaten HS 2026") ist jede Zeile mit Veranstaltungsnummer eine Prüfung
      const kind = own !== "other" ? own : near !== "other" ? near : examList && /\b\d{5}\b/.test(line) ? "exam" : "other";
      out.push({ title: title.slice(0, 140), start, end, allDay, kind, context: context.slice(0, 300) });
    });
  });
  return out.sort((a, b) => a.start - b.start);
}
