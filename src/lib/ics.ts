// Liest iCal-Dateien (ADAM, Outlook, Google …) und schreibt eigene Termine als .ics.
// Unterstützt die üblichen Fälle: Zeitzone als lokale Wandzeit, UTC, ganztägig,
// Wiederholungen (DAILY/WEEKLY/MONTHLY/YEARLY mit INTERVAL, COUNT, UNTIL, BYDAY) und EXDATE.

import type { FeedEvent, Occurrence } from "./planner";
import { DAYMS } from "./planner";

type Prop = { name: string; params: Record<string, string>; value: string };

function unfold(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  // Doppelpunkte in Parameterwerten mit Anführungszeichen überspringen
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon === -1) return null;
  const [name, ...paramParts] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

/** Datumswert -> ms. Ohne "Z" als lokale Wandzeit (in Basel passend zu Europe/Zurich). */
function parseDate(value: string): { t: number; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { t: new Date(+y, +mo - 1, +d).getTime(), allDay: true };
  const t = z
    ? Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))
    : new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)).getTime();
  return { t, allDay: false };
}

const BYDAY: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };

type RawEvent = {
  uid: string;
  title: string;
  start: number;
  end: number | null;
  allDay: boolean;
  location: string;
  description: string;
  rrule: Record<string, string> | null;
  exdates: Set<number>;
  recurrenceId: number | null;
  cancelled: boolean;
};

function expand(ev: RawEvent, windowFrom: number, windowTo: number): FeedEvent[] {
  const dur = ev.end !== null ? ev.end - ev.start : ev.allDay ? DAYMS : 0;
  const make = (start: number): FeedEvent => ({
    uid: ev.uid,
    title: ev.title,
    allDay: ev.allDay,
    location: ev.location,
    description: ev.description,
    start,
    end: ev.end !== null || ev.allDay ? start + dur : null,
  });

  if (!ev.rrule) return ev.start < windowTo && ev.start + dur >= windowFrom ? [make(ev.start)] : [];

  const freq = ev.rrule.FREQ;
  const interval = Math.max(1, Number(ev.rrule.INTERVAL ?? 1));
  const count = ev.rrule.COUNT ? Number(ev.rrule.COUNT) : Infinity;
  const until = ev.rrule.UNTIL ? (parseDate(ev.rrule.UNTIL)?.t ?? Infinity) : Infinity;
  const byday = ev.rrule.BYDAY
    ? ev.rrule.BYDAY.split(",")
        .map((d) => BYDAY[d.slice(-2)])
        .filter((d) => d !== undefined)
    : null;

  const out: FeedEvent[] = [];
  let n = 0;
  const push = (t: number) => {
    n++;
    if (t + dur >= windowFrom && t < windowTo && !ev.exdates.has(t)) out.push(make(t));
  };
  const s = new Date(ev.start);

  for (let i = 0; n < count && i < 2000; i++) {
    let candidates: number[] = [];
    if (freq === "DAILY") {
      const d = new Date(s);
      d.setDate(s.getDate() + i * interval);
      candidates = [d.getTime()];
    } else if (freq === "WEEKLY") {
      const monday = new Date(s);
      monday.setDate(s.getDate() - ((s.getDay() + 6) % 7) + i * 7 * interval);
      candidates = (byday ?? [s.getDay()])
        .map((wd) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + ((wd + 6) % 7));
          return d.getTime();
        })
        .sort((a, b) => a - b);
    } else if (freq === "MONTHLY") {
      const d = new Date(s);
      d.setMonth(s.getMonth() + i * interval);
      if (d.getDate() === s.getDate()) candidates = [d.getTime()];
    } else if (freq === "YEARLY") {
      const d = new Date(s);
      d.setFullYear(s.getFullYear() + i * interval);
      candidates = [d.getTime()];
    } else {
      push(ev.start);
      break;
    }
    let stop = false;
    for (const t of candidates) {
      if (t < ev.start) continue;
      if (t > until || n >= count) {
        stop = true;
        break;
      }
      push(t);
    }
    if (stop || (candidates.length && candidates[0] > windowTo)) break;
  }
  return out;
}

/** Liest eine iCal-Datei und liefert alle Termine im Zeitfenster. */
export function parseIcs(text: string, windowFrom: number, windowTo: number): FeedEvent[] {
  const raw: RawEvent[] = [];
  let cur: RawEvent | null = null;
  let depth = 0; // VALARM u. Ä. innerhalb von VEVENT ignorieren

  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      cur = {
        uid: "",
        title: "",
        start: 0,
        end: null,
        allDay: false,
        location: "",
        description: "",
        rrule: null,
        exdates: new Set(),
        recurrenceId: null,
        cancelled: false,
      };
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (line === "END:VEVENT") {
      if (cur.start) raw.push(cur);
      cur = null;
      continue;
    }
    if (line.startsWith("BEGIN:")) {
      depth++;
      continue;
    }
    if (line.startsWith("END:")) {
      depth--;
      continue;
    }
    if (depth > 0) continue;
    const p = parseLine(line);
    if (!p) continue;
    switch (p.name) {
      case "UID":
        cur.uid = p.value;
        break;
      case "SUMMARY":
        cur.title = unescape(p.value);
        break;
      case "LOCATION":
        cur.location = unescape(p.value);
        break;
      case "DESCRIPTION":
        cur.description = unescape(p.value).slice(0, 2000);
        break;
      case "STATUS":
        cur.cancelled = p.value.toUpperCase() === "CANCELLED";
        break;
      case "DTSTART": {
        const d = parseDate(p.value);
        if (d) {
          cur.start = d.t;
          cur.allDay = d.allDay || p.params.VALUE === "DATE";
        }
        break;
      }
      case "DTEND": {
        const d = parseDate(p.value);
        if (d) cur.end = d.t;
        break;
      }
      case "DURATION": {
        const m = /P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(p.value);
        if (m && cur.start) {
          const mins = (+(m[1] ?? 0) * 7 + +(m[2] ?? 0)) * 24 * 60 + +(m[3] ?? 0) * 60 + +(m[4] ?? 0);
          cur.end = cur.start + mins * 60_000;
        }
        break;
      }
      case "RRULE":
        cur.rrule = Object.fromEntries(
          p.value.split(";").map((kv) => {
            const [k, v] = kv.split("=");
            return [k.toUpperCase(), v ?? ""];
          }),
        );
        break;
      case "EXDATE":
        for (const v of p.value.split(",")) {
          const d = parseDate(v);
          if (d) cur.exdates.add(d.t);
        }
        break;
      case "RECURRENCE-ID": {
        const d = parseDate(p.value);
        if (d) cur.recurrenceId = d.t;
        break;
      }
    }
  }

  // Einzeln geänderte Wiederholungen ersetzen das ursprüngliche Vorkommen
  for (const o of raw.filter((e) => e.recurrenceId !== null)) {
    raw.find((e) => e.uid === o.uid && e.recurrenceId === null)?.exdates.add(o.recurrenceId!);
  }

  const out: FeedEvent[] = [];
  for (const e of raw) {
    if (e.cancelled) continue;
    if (!e.uid) e.uid = `${e.title}@${e.start}`;
    out.push(...expand(e, windowFrom, windowTo));
  }
  return out.sort((a, b) => a.start - b.start).slice(0, 3000);
}

// ---------- Export ----------

const pad = (n: number) => String(n).padStart(2, "0");
function icsUtc(t: number) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
function icsDate(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

function fold(line: string) {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? " " : "") + line.slice(i, i + 73));
  return parts.join("\r\n");
}

/** Erzeugt eine .ics-Datei, die sich in jeden Kalender (Handy, Outlook, Google) importieren lässt. */
export function toIcs(list: Occurrence[]) {
  const now = icsUtc(Date.now());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jarvis Uni-Cockpit//DE", "CALSCALE:GREGORIAN"];
  for (const o of list) {
    lines.push("BEGIN:VEVENT", `UID:${o.key.replace(/[^\w:.-]/g, "-")}@jarvis`, `DTSTAMP:${now}`);
    if (o.allDay) lines.push(`DTSTART;VALUE=DATE:${icsDate(o.start)}`, `DTEND;VALUE=DATE:${icsDate(o.end)}`);
    else lines.push(`DTSTART:${icsUtc(o.start)}`, `DTEND:${icsUtc(o.end)}`);
    const title = o.kind === "lecture" && o.type ? `${o.title} (${o.type})` : o.title;
    lines.push(`SUMMARY:${esc(title)}`);
    if (o.location) lines.push(`LOCATION:${esc(o.location)}`);
    if (o.note) lines.push(`DESCRIPTION:${esc(o.note)}`);
    if (o.kind === "exam" || o.kind === "deadline")
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, "TRIGGER:-P1D", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
