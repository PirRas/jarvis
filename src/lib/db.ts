"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CalEvent, Feed, FeedCache, LessonPreview, QuickLink, Slot } from "./planner";
import type { Notes, Study, Video } from "./schema";
import { newCard, startOfDay, type CardQueue, type CardState, type Rating } from "./srs";

// Jeder gespeicherte Eintrag trägt seine letzte Änderungszeit; daran entscheidet der Abgleich,
// welcher Stand neuer ist.
type Synced = { updatedAt?: number };

export type Lecture = Synced & {
  id: string;
  fileName: string;
  createdAt: number;
  title: string;
  course: string;
  notes: Notes;
  study: Study;
  videos?: Video[];
};

export type QuizResult = Synced & {
  id: string; // `${lectureId}:${questionIndex}`
  lectureId: string;
  correct: boolean;
  answeredAt: number;
};

export type ReviewLog = Synced & {
  id: string;
  cardId: string;
  lectureId: string;
  rating: Rating;
  queueBefore: CardQueue;
  at: number;
  ms: number; // Antwortzeit
};

/** Merkt sich Löschungen, damit sie auch auf anderen Geräten ankommen. */
export type Tombstone = { key: string; store: SyncStore; id: string; updatedAt: number };

export const SYNC_STORES = ["lectures", "cards", "quiz", "reviews", "slots", "events", "feeds", "links", "previews"] as const;
export type SyncStore = (typeof SYNC_STORES)[number];

interface StudyDB extends DBSchema {
  lectures: { key: string; value: Lecture };
  cards: { key: string; value: CardState & Synced; indexes: { byLecture: string } };
  quiz: { key: string; value: QuizResult; indexes: { byLecture: string } };
  reviews: { key: string; value: ReviewLog; indexes: { byAt: number; byLecture: string } };
  tombstones: { key: string; value: Tombstone };
  slots: { key: string; value: Slot };
  events: { key: string; value: CalEvent };
  feeds: { key: string; value: Feed };
  links: { key: string; value: QuickLink };
  previews: { key: string; value: LessonPreview };
  feedcache: { key: string; value: FeedCache }; // nur lokal, wird aus den Abos neu geladen
}

let dbPromise: Promise<IDBPDatabase<StudyDB>> | null = null;

function db() {
  dbPromise ??= openDB<StudyDB>("vorlesungen", 3, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore("lectures", { keyPath: "id" });
        d.createObjectStore("cards", { keyPath: "id" }).createIndex("byLecture", "lectureId");
        d.createObjectStore("quiz", { keyPath: "id" }).createIndex("byLecture", "lectureId");
      }
      if (oldVersion < 2) {
        // Version 1 hatte fortlaufende Zahlen als Schlüssel, die zwischen Geräten kollidieren.
        if (d.objectStoreNames.contains("reviews")) d.deleteObjectStore("reviews");
        const reviews = d.createObjectStore("reviews", { keyPath: "id" });
        reviews.createIndex("byAt", "at");
        reviews.createIndex("byLecture", "lectureId");
        d.createObjectStore("tombstones", { keyPath: "key" });
      }
      if (oldVersion < 3) {
        // Uni-Cockpit: Stundenplan, Termine, Kalender-Abos, Links, Lektions-Vorschauen
        for (const name of ["slots", "events", "feeds", "links", "previews", "feedcache"] as const) {
          d.createObjectStore(name, { keyPath: "id" });
        }
      }
    },
  });
  return dbPromise;
}

// ---------- Änderungen melden (löst den Abgleich aus) ----------

const listeners = new Set<() => void>();
export function onLocalChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function changed() {
  for (const fn of listeners) fn();
}

const stamp = <T extends object>(v: T) => ({ ...v, updatedAt: Date.now() });

// ---------- Vorlesungen ----------

export async function saveLecture(lecture: Lecture) {
  const d = await db();
  const tx = d.transaction(["lectures", "cards"], "readwrite");
  await tx.objectStore("lectures").put(stamp(lecture));
  for (const [i, card] of lecture.study.flashcards.entries()) {
    await tx.objectStore("cards").put(stamp(newCard(lecture.id, card, `${lecture.id}:${String(i).padStart(4, "0")}`)));
  }
  await tx.done;
  changed();
}

export async function listLectures() {
  const all = await (await db()).getAll("lectures");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLecture(id: string) {
  return (await db()).get("lectures", id);
}

export async function updateLectureMeta(id: string, title: string, course: string) {
  const d = await db();
  const lecture = await d.get("lectures", id);
  if (lecture) await d.put("lectures", stamp({ ...lecture, title, course }));
  changed();
}

export async function setLectureVideos(id: string, videos: Video[]) {
  const d = await db();
  const lecture = await d.get("lectures", id);
  if (lecture) await d.put("lectures", stamp({ ...lecture, videos }));
  changed();
}

export async function deleteLecture(id: string) {
  const d = await db();
  const tx = d.transaction(["lectures", "cards", "quiz", "reviews", "tombstones"], "readwrite");
  const now = Date.now();
  const bury = (store: SyncStore, key: string) =>
    tx.objectStore("tombstones").put({ key: `${store}:${key}`, store, id: key, updatedAt: now });

  await tx.objectStore("lectures").delete(id);
  await bury("lectures", id);
  for (const store of ["cards", "quiz", "reviews"] as const) {
    const keys = await tx.objectStore(store).index("byLecture").getAllKeys(id);
    for (const k of keys) {
      await tx.objectStore(store).delete(k);
      await bury(store, k);
    }
  }
  await tx.done;
  changed();
}

// ---------- Karten ----------

export async function cardsForLecture(lectureId: string) {
  return (await db()).getAllFromIndex("cards", "byLecture", lectureId);
}

export async function allCards() {
  return (await db()).getAll("cards");
}

export async function saveCard(card: CardState) {
  await (await db()).put("cards", stamp(card));
  changed();
}

export async function deleteCard(id: string) {
  const d = await db();
  const tx = d.transaction(["cards", "tombstones"], "readwrite");
  await tx.objectStore("cards").delete(id);
  await tx.objectStore("tombstones").put({ key: `cards:${id}`, store: "cards", id, updatedAt: Date.now() });
  await tx.done;
  changed();
}

// ---------- Wiederholungen und Quiz ----------

export async function logReview(log: Omit<ReviewLog, "id">) {
  await (await db()).put("reviews", stamp({ ...log, id: crypto.randomUUID() }));
  changed();
}

export async function reviewsSince(t: number) {
  return (await db()).getAllFromIndex("reviews", "byAt", IDBKeyRange.lowerBound(t));
}

/** Wie viele neue Karten heute noch eingeführt werden dürfen (Tageslimit wie bei Anki). */
export async function newCardsLeftToday(limit: number) {
  const today = await reviewsSince(startOfDay());
  const introduced = new Set(today.filter((r) => r.queueBefore === "new").map((r) => r.cardId)).size;
  return Math.max(0, limit - introduced);
}

export async function saveQuizResult(result: QuizResult) {
  await (await db()).put("quiz", stamp(result));
  changed();
}

export async function quizResultsForLecture(lectureId: string) {
  return (await db()).getAllFromIndex("quiz", "byLecture", lectureId);
}

// ---------- Cockpit: Stundenplan, Termine, Abos, Links, Vorschauen ----------

type PlannerStore = "slots" | "events" | "feeds" | "links" | "previews";
type PlannerValue<S extends PlannerStore> = StudyDB[S]["value"];

export async function listItems<S extends PlannerStore>(store: S): Promise<PlannerValue<S>[]> {
  return (await (await db()).getAll(store)) as PlannerValue<S>[];
}

export async function getItem<S extends PlannerStore>(store: S, id: string): Promise<PlannerValue<S> | undefined> {
  return (await (await db()).get(store, id)) as PlannerValue<S> | undefined;
}

export async function putItems<S extends PlannerStore>(store: S, values: PlannerValue<S>[]) {
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  const os = tx.store as unknown as { put(v: unknown): Promise<unknown> };
  for (const v of values) await os.put(stamp(v));
  await tx.done;
  changed();
}

export const putItem = <S extends PlannerStore>(store: S, value: PlannerValue<S>) => putItems(store, [value]);

export async function deleteItems(store: PlannerStore, ids: string[]) {
  const d = await db();
  const tx = d.transaction([store, "tombstones"], "readwrite");
  const now = Date.now();
  for (const id of ids) {
    await tx.objectStore(store).delete(id);
    await tx.objectStore("tombstones").put({ key: `${store}:${id}`, store, id, updatedAt: now });
  }
  await tx.done;
  changed();
}

export async function allFeedCaches() {
  return (await db()).getAll("feedcache");
}

export async function setFeedCache(cache: FeedCache) {
  await (await db()).put("feedcache", cache);
}

export async function deleteFeedCache(id: string) {
  await (await db()).delete("feedcache", id);
}

// ---------- Zugriff für den Abgleich ----------

type AnyRecord = { id: string; updatedAt?: number };

/** Alles, was sich seit `since` lokal geändert hat, inklusive Löschungen. */
export async function localChangesSince(since: number) {
  const d = await db();
  const items: { store: SyncStore; id: string; data: AnyRecord | null; updatedAt: number }[] = [];
  for (const store of SYNC_STORES) {
    for (const rec of (await d.getAll(store)) as AnyRecord[]) {
      const t = rec.updatedAt ?? 1; // Einträge aus der Zeit vor dem Abgleich einmalig hochladen
      if (t > since) items.push({ store, id: rec.id, data: rec, updatedAt: t });
    }
  }
  for (const t of await d.getAll("tombstones")) {
    if (t.updatedAt > since) items.push({ store: t.store, id: t.id, data: null, updatedAt: t.updatedAt });
  }
  return items;
}

/** Übernimmt einen Stand vom Server, wenn er neuer ist als der lokale. Gibt true zurück, wenn sich etwas geändert hat. */
export async function applyRemote(store: SyncStore, id: string, data: AnyRecord | null, updatedAt: number) {
  const d = await db();
  const tx = d.transaction([store, "tombstones"], "readwrite");
  const os = tx.objectStore(store) as unknown as {
    get(k: string): Promise<AnyRecord | undefined>;
    put(v: AnyRecord): Promise<unknown>;
    delete(k: string): Promise<void>;
  };
  const local = await os.get(id);
  const grave = await tx.objectStore("tombstones").get(`${store}:${id}`);
  const localTime = Math.max(local?.updatedAt ?? 0, grave?.updatedAt ?? 0);
  if (localTime >= updatedAt) {
    await tx.done;
    return false;
  }
  if (data) {
    await os.put({ ...data, updatedAt });
    if (grave) await tx.objectStore("tombstones").delete(`${store}:${id}`);
  } else {
    if (local) await os.delete(id);
    await tx.objectStore("tombstones").put({ key: `${store}:${id}`, store, id, updatedAt });
  }
  await tx.done;
  return true;
}

/** Löscht alle lokalen Daten, z. B. beim Abmelden auf einem fremden Gerät. */
export async function clearLocalData() {
  const d = await db();
  for (const store of [...SYNC_STORES, "tombstones", "feedcache"] as const) await d.clear(store);
}

// ---------- Einstellungen: nur pro Gerät, daher localStorage ----------

const SETTINGS_KEY = "vorlesung-settings";
export type Settings = { newPerDay: number };
const DEFAULT_SETTINGS: Settings = { newPerDay: 20 };

export function getSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Speicher nicht verfügbar: Einstellung gilt nur für diese Sitzung.
  }
}
