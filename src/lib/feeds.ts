"use client";

import { allFeedCaches, listItems, setFeedCache } from "./db";
import { parseIcs } from "./ics";
import { addDays, HOUR, type Feed } from "./planner";

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
    const events = parseIcs(await res.text(), addDays(now, -60), addDays(now, 270));
    await setFeedCache({ id: feed.id, fetchedAt: now, error: null, events });
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
