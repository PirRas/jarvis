"use client";

import { useCallback, useEffect, useState } from "react";
import { allCards, allFeedCaches, getSettings, listItems, listLectures, newCardsLeftToday, onLocalChange, putItems, type Lecture } from "./db";
import { FEEDS_EVENT, refreshFeeds } from "./feeds";
import { DEFAULT_LINKS, EMPTY_PLANNER, type LessonPreview, type PlannerData, type QuickLink } from "./planner";
import type { CardState } from "./srs";
import { REMOTE_CHANGE_EVENT } from "./sync";

export type PlannerState = {
  loaded: boolean;
  data: PlannerData;
  links: QuickLink[];
  previews: LessonPreview[];
  lectures: Lecture[];
  cards: CardState[];
  newLeft: number;
};

const INITIAL: PlannerState = {
  loaded: false,
  data: EMPTY_PLANNER,
  links: [],
  previews: [],
  lectures: [],
  cards: [],
  newLeft: 20,
};

const SEEDED_KEY = "links-seeded-v1";

/** Standard-Links einmal pro Gerät anlegen; feste IDs, damit der Abgleich keine Doppel erzeugt. */
async function seedLinks(existing: QuickLink[]) {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return false;
    localStorage.setItem(SEEDED_KEY, "1");
  } catch {
    return false;
  }
  if (existing.length) return false;
  await putItems(
    "links",
    DEFAULT_LINKS.map((l) => ({ ...l, id: `default-${l.order}` })),
  );
  return true;
}

/** Lädt alles, was das Cockpit braucht, und hält es aktuell (lokale Änderungen, Abgleich, Abos, Uhrzeit). */
export function usePlanner() {
  const [state, setState] = useState<PlannerState>(INITIAL);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [slots, events, feeds, caches, links, previews, lectures, cards, newLeft] = await Promise.all([
      listItems("slots"),
      listItems("events"),
      listItems("feeds"),
      allFeedCaches(),
      listItems("links"),
      listItems("previews"),
      listLectures(),
      allCards(),
      newCardsLeftToday(getSettings().newPerDay),
    ]);
    if (await seedLinks(links)) return; // putItems löst selbst ein Neuladen aus
    setState({
      loaded: true,
      data: { slots, events, feeds, caches },
      links: links.sort((a, b) => a.order - b.order),
      previews,
      lectures,
      cards,
      newLeft,
    });
  }, []);

  useEffect(() => {
    load();
    refreshFeeds();
    const off = onLocalChange(load);
    window.addEventListener(REMOTE_CHANGE_EVENT, load);
    window.addEventListener(FEEDS_EVENT, load);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      refreshFeeds();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      off();
      window.removeEventListener(REMOTE_CHANGE_EVENT, load);
      window.removeEventListener(FEEDS_EVENT, load);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { ...state, now, reload: load };
}
