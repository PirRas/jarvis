"use client";

import { allFeedCaches, deleteItems, listItems, putItems, setFeedCache } from "./db";
import { parseIcs } from "./ics";
import { addDays, HOUR, type Feed, type FeedEvent } from "./planner";
import { deriveTimetable } from "./timetable";

// Kalender-Abos werden beim Öffnen der App und danach regelmäßig neu geladen.

const STALE_MS = 3 * HOUR;
export const FEEDS_EVENT = "feeds:updated";

export async function fetchFeed(feed: Feed) {
  const now = Date.now();
  try {
    const res = await fetch("/api/ics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: feed.url }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `Fehler ${res.status}` }));
      throw new Error(error);
    }
    // Stundenplan: das ganze Semester lesen, damit Beginn und Ende der Kurse stimmen
    const back = feed.role === "timetable" ? 200 : 60;
    const events = parseIcs(await res.text(), addDays(now, -back), addDays(now, 270));
    await setFeedCache({ id: feed.id, fetchedAt: now, error: null, events });
    if (feed.role === "timetable") await applyTimetable(events);
  } catch (e) {
    const prev = (await allFeedCaches()).find((c) => c.id === feed.id);
    await setFeedCache({
      id: feed.id,
      fetchedAt: prev?.fetchedAt ?? 0,
      error: e instanceof Error ? e.message : String(e),
      events: prev?.events ?? [],
    });
  }
}

/** Vergleich ohne Zeitstempel, damit unveränderte Einträge nicht bei jedem Abruf neu abgeglichen werden. */
function canon(o: object) {
  const r = o as Record<string, unknown>;
  const keys = Object.keys(r).filter((k) => k !== "createdAt" && k !== "updatedAt" && r[k] !== undefined);
  return JSON.stringify(keys.sort().map((k) => [k, r[k]]));
}
const same = (a: object, b: object) => canon(a) === canon(b);

/**
 * Überträgt den Stundenplan aus dem Abo in Stundenplan und Prüfungen. Einträge aus dem Abo haben feste IDs
 * ("abo-…"), damit jedes Gerät dasselbe Ergebnis schreibt. Selbst angelegte Einträge bleiben unberührt;
 * die Vorlage des Departements wird ersetzt, ausser Prüfungen, die im Abo (noch) fehlen.
 */
async function applyTimetable(events: FeedEvent[]) {
  const { slots, exams } = deriveTimetable(events);
  // Leeres Abo (z. B. Semester vorbei, neues noch nicht freigeschaltet): nichts löschen.
  if (!slots.length) return;

  const [oldSlots, oldEvents] = await Promise.all([listItems("slots"), listItems("events")]);

  const slotPuts = slots
    .map((s) => {
      const old = oldSlots.find((o) => o.id === s.id);
      return old && same(old, s) ? null : { ...s, createdAt: old?.createdAt ?? s.createdAt };
    })
    .filter((s) => s !== null);
  const slotDeletes = oldSlots
    .filter((o) => (o.id.startsWith("abo-") && !slots.some((s) => s.id === o.id)) || o.id.startsWith("tpl-hs26-"))
    .map((o) => o.id);

  const examPuts = exams
    .map((e) => {
      const old = oldEvents.find((o) => o.id === e.id);
      return old && same(old, e) ? null : { ...e, createdAt: old?.createdAt ?? e.createdAt };
    })
    .filter((e) => e !== null);
  const examDeletes = oldEvents
    .filter(
      (o) =>
        (o.id.startsWith("abo-exam-") && !exams.some((e) => e.id === o.id)) ||
        // Provisorische Prüfung aus der Vorlage, wenn das Abo diese Prüfung kennt
        exams.some((e) => o.id === `tpl-hs26-exam-${e.id.split("-")[2]}`),
    )
    .map((o) => o.id);

  if (slotPuts.length) await putItems("slots", slotPuts);
  if (slotDeletes.length) await deleteItems("slots", slotDeletes);
  if (examPuts.length) await putItems("events", examPuts);
  if (examDeletes.length) await deleteItems("events", examDeletes);
}

let running: Promise<void> | null = null;

/** Lädt alle Abos, deren Stand älter als ein paar Stunden ist (oder alle mit force). */
export function refreshFeeds(force = false) {
  running ??= (async () => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const [feeds, caches] = await Promise.all([listItems("feeds"), allFeedCaches()]);
      const due = feeds.filter((f) => {
        const c = caches.find((c) => c.id === f.id);
        return force || !c || Date.now() - c.fetchedAt > STALE_MS;
      });
      if (!due.length) return;
      await Promise.all(due.map(fetchFeed));
      window.dispatchEvent(new Event(FEEDS_EVENT));
    } finally {
      running = null;
    }
  })();
  return running;
}
