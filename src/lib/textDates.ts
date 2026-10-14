// Findet Termine in kopiertem Text, z. B. einer Prüfungsankündigung aus ADAM oder einer Mail.
// Erkennt "15.01.2027", "15.1.27", "15. Januar 2027", "Fr, 15. Jan." sowie Uhrzeiten wie "14:15", "14.15 Uhr", "14–16 Uhr".

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

const NUMERIC = /\b(\d{1,2})\.\s?(\d{1,2})\.(\d{4}|\d{2})?(?!\d)/g;
const WORDY =
  /\b(\d{1,2})\.?\s+(januar|jänner|january|jan|februar|february|feb|märz|maerz|march|mär|mar|april|apr|mai|may|juni|june|jun|juli|july|jul|august|aug|september|sept|sep|oktober|october|okt|oct|november|nov|dezember|december|dez|dec)\.?(?:\s+(\d{4}))?/gi;
const TIME =
  /\b(\d{1,2})[:.](\d{2})(?:\s*(?:uhr|h))?(?:\s*(?:-|–|—|bis)\s*(\d{1,2})(?:[:.](\d{2}))?)?|\b(\d{1,2})\s*(?:-|–|bis)\s*(\d{1,2})\s*uhr/gi;

function year(y: string | undefined, month: number, day: number, now: number) {
  if (y) return y.length === 2 ? 2000 + Number(y) : Number(y);
  // Ohne Jahr: das nächste Vorkommen ab heute (mit einer Woche Kulanz)
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
    .replace(/\b(uhr|am|um|von|bis|ab)\b/gi, " ")
    .replace(/[.]{3,}/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s|•·,;:–—-]+|[\s|•·,;:–—-]+$/g, "")
    .trim();
}

/** Sucht alle Daten im Text; pro Fundstelle die Zeile (bzw. Nachbarzeile) als Titel und Kontext. */
export function findDates(text: string, now = Date.now()): FoundDate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out: FoundDate[] = [];
  const seen = new Set<string>();

  lines.forEach((line, i) => {
    if (!line) return;
    const hits: { day: number; month: number; y?: string }[] = [];
    for (const m of line.matchAll(NUMERIC)) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) hits.push({ day, month, y: m[3] });
    }
    for (const m of line.matchAll(WORDY)) {
      const month = MONTHS[m[2].toLowerCase()];
      const day = Number(m[1]);
      if (month && day >= 1 && day <= 31) hits.push({ day, month, y: m[3] });
    }
    if (!hits.length) return;

    // Daten entfernen, bevor Uhrzeiten gesucht werden (sonst wird "15.01.2027" als 15:01 gelesen)
    const times = [...line.replace(NUMERIC, " ").replace(WORDY, " ").matchAll(TIME)];
    const prev = lines[i - 1] ?? "";
    const next = lines[i + 1] ?? "";
    let title = cleanTitle(line);
    // Steht in der Zeile nur das Datum, ist der Titel meist in der Zeile davor
    if (title.length < 4) title = cleanTitle(prev) || cleanTitle(next) || "Termin";
    const context = [prev, line, next].filter(Boolean).join(" · ");

    for (const h of hits) {
      const y = year(h.y, h.month, h.day, now);
      let start = new Date(y, h.month - 1, h.day).getTime();
      let end: number | null = null;
      let allDay = true;
      const t = times[0];
      if (t) {
        if (t[1] !== undefined) {
          start = new Date(y, h.month - 1, h.day, Number(t[1]), Number(t[2])).getTime();
          if (t[3] !== undefined) end = new Date(y, h.month - 1, h.day, Number(t[3]), Number(t[4] ?? 0)).getTime();
        } else {
          start = new Date(y, h.month - 1, h.day, Number(t[5])).getTime();
          end = new Date(y, h.month - 1, h.day, Number(t[6])).getTime();
        }
        allDay = false;
        if (end !== null && end <= start) end = null;
      }
      const key = `${start}|${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ title: title.slice(0, 140), start, end, allDay, kind: guessKind(context), context: context.slice(0, 300) });
    }
  });
  return out.sort((a, b) => a.start - b.start);
}
