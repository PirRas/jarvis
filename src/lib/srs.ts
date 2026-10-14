// Verteilte Wiederholung nach dem Vorbild von Anki (SM-2 mit Lernstufen).

import type { Flashcard } from "./schema";

export type CardQueue = "new" | "learning" | "review";

export type CardState = {
  id: string;
  lectureId: string;
  front: string;
  back: string;
  topic: string;
  kind: Flashcard["kind"];
  custom: boolean; // selbst angelegt statt generiert
  suspended: boolean; // zurückgestellt: wird nicht abgefragt
  queue: CardQueue;
  step: number; // aktuelle Lernstufe (nur in "learning")
  ease: number; // Multiplikator für das nächste Intervall
  interval: number; // in Tagen (nur in "review" relevant)
  lapses: number; // wie oft vergessen
  due: number; // Zeitstempel (ms)
  createdAt: number;
};

export type Rating = 1 | 2 | 3 | 4; // Nochmal, Schwer, Gut, Einfach

export const RATING_LABEL: Record<Rating, string> = { 1: "Nochmal", 2: "Schwer", 3: "Gut", 4: "Einfach" };

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// Lernstufen wie Ankis Standard: 1 Min., 10 Min., danach 1 Tag.
const LEARN_STEPS = [1, 10];
const RELEARN_STEPS = [10];
const GRADUATING_INTERVAL = 1;
const EASY_INTERVAL = 4;

export function newCard(lectureId: string, card: Flashcard, id: string, custom = false): CardState {
  return {
    id,
    lectureId,
    ...card,
    custom,
    suspended: false,
    queue: "new",
    step: 0,
    ease: 2.5,
    interval: 0,
    lapses: 0,
    due: 0,
    createdAt: Date.now(),
  };
}

export function schedule(card: CardState, rating: Rating, now = Date.now()): CardState {
  const c = { ...card };
  const relearning = c.queue === "learning" && c.lapses > 0 && c.interval > 0;
  const steps = relearning ? RELEARN_STEPS : LEARN_STEPS;

  const graduate = (days: number) => {
    c.queue = "review";
    c.step = 0;
    c.interval = days;
    c.due = now + days * DAY;
  };
  const toStep = (step: number) => {
    c.queue = "learning";
    c.step = step;
    c.due = now + steps[step] * MINUTE;
  };

  if (c.queue === "new" || c.queue === "learning") {
    if (rating === 1) toStep(0);
    else if (rating === 2) {
      // Schwer: dieselbe Stufe wiederholen, etwas länger warten.
      c.queue = "learning";
      const cur = steps[c.step] ?? steps[0];
      const next = steps[c.step + 1] ?? cur * 1.5;
      c.due = now + ((cur + next) / 2) * MINUTE;
    } else if (rating === 3) {
      if (c.queue === "new") toStep(Math.min(1, steps.length - 1));
      else if (c.step + 1 < steps.length) toStep(c.step + 1);
      else graduate(relearning ? Math.max(1, c.interval) : GRADUATING_INTERVAL);
    } else {
      graduate(relearning ? Math.max(1, c.interval) * 1.5 : EASY_INTERVAL);
    }
    return c;
  }

  // Wiederholungskarte
  if (rating === 1) {
    c.lapses += 1;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.interval = Math.max(1, c.interval * 0.5);
    c.queue = "learning";
    c.step = 0;
    c.due = now + RELEARN_STEPS[0] * MINUTE;
    return c;
  }
  if (rating === 2) {
    c.ease = Math.max(1.3, c.ease - 0.15);
    c.interval = Math.max(c.interval + 1, c.interval * 1.2);
  } else if (rating === 3) {
    c.interval = Math.max(c.interval + 1, c.interval * c.ease);
  } else {
    c.ease += 0.15;
    c.interval = Math.max(c.interval + 1, c.interval * c.ease * 1.3);
  }
  c.due = now + c.interval * DAY;
  return c;
}

export function formatInterval(ms: number) {
  if (ms < 60 * MINUTE) return `${Math.max(1, Math.round(ms / MINUTE))} Min.`;
  if (ms < DAY) return `${Math.round(ms / (60 * MINUTE))} Std.`;
  const days = Math.round(ms / DAY);
  if (days < 31) return days === 1 ? "1 Tag" : `${days} Tage`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? "1 Monat" : `${months} Monate`;
  return `${(days / 365).toFixed(1).replace(".", ",")} J.`;
}

/** Vorschau für die Bewertungsknöpfe, wie Anki sie über den Knöpfen zeigt. */
export function previewInterval(card: CardState, rating: Rating) {
  const now = Date.now();
  return formatInterval(schedule(card, rating, now).due - now);
}

export function isMastered(card: CardState) {
  return card.queue === "review" && card.interval >= 21;
}

export const startOfDay = (t = Date.now()) => {
  const d = new Date(t);
  d.setHours(4, 0, 0, 0); // Anki beginnt den neuen Tag um 4 Uhr
  if (d.getTime() > t) d.setDate(d.getDate() - 1);
  return d.getTime();
};
export const endOfDay = (t = Date.now()) => startOfDay(t) + DAY;
export { DAY };

export type Counts = { new: number; learning: number; review: number };

/** Zählt, was heute ansteht: neue Karten (mit Tageslimit), Lernkarten und fällige Wiederholungen. */
export function countDue(cards: CardState[], newLeft: number, now = Date.now()): Counts {
  const active = cards.filter((c) => !c.suspended);
  const dayEnd = endOfDay(now);
  return {
    new: Math.min(newLeft, active.filter((c) => c.queue === "new").length),
    learning: active.filter((c) => c.queue === "learning" && c.due <= dayEnd).length,
    review: active.filter((c) => c.queue === "review" && c.due <= dayEnd).length,
  };
}

/**
 * Wählt die nächste Karte: zuerst fällige Lernkarten, dann Wiederholungen, dann neue Karten.
 * Gibt außerdem zurück, wann die nächste Lernkarte fällig wird, falls gerade nichts ansteht.
 */
export function nextCard(cards: CardState[], newLeft: number, now = Date.now()) {
  const active = cards.filter((c) => !c.suspended);
  const dueLearning = active.filter((c) => c.queue === "learning" && c.due <= now).sort((a, b) => a.due - b.due);
  if (dueLearning.length) return { card: dueLearning[0], waitUntil: null };
  const dueReview = active.filter((c) => c.queue === "review" && c.due <= endOfDay(now)).sort((a, b) => a.due - b.due);
  if (dueReview.length) return { card: dueReview[0], waitUntil: null };
  if (newLeft > 0) {
    const fresh = active.filter((c) => c.queue === "new").sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id, undefined, { numeric: true }));
    if (fresh.length) return { card: fresh[0], waitUntil: null };
  }
  // Lernkarten, die heute noch fällig werden: wie Anki vorziehen, wenn sonst nichts zu tun ist.
  const laterLearning = active.filter((c) => c.queue === "learning" && c.due <= endOfDay(now)).sort((a, b) => a.due - b.due);
  if (laterLearning.length) return { card: laterLearning[0], waitUntil: laterLearning[0].due };
  return { card: null, waitUntil: null };
}
