"use client";

// Raum einer Lektion live aus dem Vorlesungsverzeichnis: vor jeder Lektion neu prüfen
// und melden, wenn er vom üblichen Raum dieser Veranstaltung abweicht.

import { useEffect, useState } from "react";
import { HOUR, isoDate, isoWeekday, MIN, parseIsoDate, parseTime, type Occurrence } from "./planner";

type VvSession = { date: string; start: string; end: string; room: string };
type VvOffer = { id: string; number: string; title: string; url: string; sessions: VvSession[] };
type VvResult = { nr: string; checkedAt: number; offers: VvOffer[] };

export type RoomInfo =
  | { state: "loading" }
  | { state: "error"; message: string; cached?: RoomFound | RoomMissing }
  | RoomFound
  | RoomMissing;

export type RoomFound = {
  state: "found";
  room: string;
  regular: string; // üblicher Raum dieser Veranstaltung zu diesem Zeitpunkt
  changed: boolean; // weicht vom üblichen Raum ab
  alternatives: string[]; // weitere mögliche Räume (mehrere Gruppen zur gleichen Zeit)
  checkedAt: number;
  url: string;
};
export type RoomMissing = { state: "missing"; checkedAt: number; url: string }; // kein Eintrag an diesem Tag

const CACHE_KEY = (nr: string) => `vv:${nr}`;
const memory = new Map<string, { at: number; promise: Promise<VvResult> }>();

/** Wie alt darf der Stand sein? Je näher die Lektion, desto frischer. */
function maxAge(start: number, now = Date.now()) {
  const until = start - now;
  if (until < 3 * HOUR) return 10 * MIN;
  if (until < 24 * HOUR) return 30 * MIN;
  return 6 * HOUR;
}

function readCache(nr: string): VvResult | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY(nr)) ?? "null");
  } catch {
    return null;
  }
}

function writeCache(r: VvResult) {
  try {
    localStorage.setItem(CACHE_KEY(r.nr), JSON.stringify(r));
  } catch {
    // ohne Speicher wird beim nächsten Mal einfach neu abgefragt
  }
}

async function load(nr: string, age: number): Promise<VvResult> {
  const cached = readCache(nr);
  if (cached && Date.now() - cached.checkedAt < age) return cached;
  const mem = memory.get(nr);
  if (mem && Date.now() - mem.at < 60_000) return mem.promise;
  const promise = fetch(`/api/vv?nr=${encodeURIComponent(nr)}`).then(async (res) => {
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `Fehler ${res.status}`);
    writeCache(body);
    return body as VvResult;
  });
  memory.set(nr, { at: Date.now(), promise });
  promise.catch(() => memory.delete(nr));
  return promise;
}

const normRoom = (r: string) => r.toLowerCase().replace(/\s+/g, " ").trim();

/** Ordnet einer Lektion den Raum aus dem Vorlesungsverzeichnis zu. */
export function matchRoom(o: Occurrence, data: VvResult): RoomFound | RoomMissing {
  const date = isoDate(o.start);
  const startMin = new Date(o.start).getHours() * 60 + new Date(o.start).getMinutes();
  const weekday = isoWeekday(o.start);

  type Hit = { offer: VvOffer; session: VvSession };
  const hits: Hit[] = [];
  for (const offer of data.offers) {
    for (const session of offer.sessions) {
      if (session.date === date && (!session.start || Math.abs(parseTime(session.start) - startMin) <= 30)) {
        hits.push({ offer, session });
      }
    }
  }
  const url = hits[0]?.offer.url ?? data.offers[0]?.url ?? "https://vorlesungsverzeichnis.unibas.ch";
  if (!hits.length) return { state: "missing", checkedAt: data.checkedAt, url };

  // Mehrere Gruppen zur gleichen Zeit (z. B. Mathe für verschiedene Fächer): Pharmazie bevorzugen,
  // danach die Gruppe, deren Titel am besten zum Eintrag passt.
  const score = (h: Hit) =>
    (/pharma/i.test(h.offer.title) ? 2 : 0) +
    (o.type && h.offer.title.toLowerCase().includes(o.type.split(" ")[0].toLowerCase()) ? 1 : 0);
  hits.sort((a, b) => score(b) - score(a));
  const best = hits[0];

  // Üblicher Raum: der häufigste Raum dieser Gruppe am gleichen Wochentag zur gleichen Zeit
  const counts = new Map<string, { room: string; n: number }>();
  for (const s of best.offer.sessions) {
    if (isoWeekday(parseIsoDate(s.date)) !== weekday || s.start !== best.session.start) continue;
    const k = normRoom(s.room);
    const c = counts.get(k) ?? { room: s.room, n: 0 };
    c.n++;
    counts.set(k, c);
  }
  const regular = [...counts.values()].sort((a, b) => b.n - a.n)[0]?.room ?? best.session.room;
  const alternatives = [
    ...new Set(hits.filter((h) => score(h) === score(best)).map((h) => h.session.room)),
  ].filter((r) => normRoom(r) !== normRoom(best.session.room));

  return {
    state: "found",
    room: best.session.room,
    regular,
    changed: !!regular && normRoom(regular) !== normRoom(best.session.room),
    alternatives,
    checkedAt: data.checkedAt,
    url: best.offer.url,
  };
}

/** Raum für eine Lektion; prüft automatisch erneut, je näher die Lektion rückt. */
export function useRoom(o: Occurrence | null, code: string | undefined): RoomInfo | null {
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const key = o && code ? `${code}|${o.start}` : null;

  useEffect(() => {
    if (!o || !code) {
      setInfo(null);
      return;
    }
    let alive = true;
    const cached = readCache(code);
    setInfo(cached ? matchRoom(o, cached) : { state: "loading" });

    const check = () =>
      load(code, maxAge(o.start))
        .then((d) => alive && setInfo(matchRoom(o, d)))
        .catch((e: Error) => {
          if (!alive) return;
          const c = readCache(code);
          setInfo({ state: "error", message: e.message, cached: c ? matchRoom(o, c) : undefined });
        });
    check();
    const timer = setInterval(check, 5 * MIN);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return info;
}
