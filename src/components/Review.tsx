"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Counts } from "@/components/Counts";
import { Md } from "@/components/Md";
import { allCards, cardsForLecture, getSettings, logReview, newCardsLeftToday, saveCard } from "@/lib/db";
import {
  countDue,
  formatInterval,
  nextCard,
  previewInterval,
  RATING_LABEL,
  schedule,
  type CardState,
  type Rating,
} from "@/lib/srs";

const KIND_LABEL: Record<CardState["kind"], string> = {
  definition: "Definition",
  konzept: "Konzept",
  anwendung: "Anwendung",
  formel: "Formel",
  fakt: "Fakt",
};

/** Lernsitzung im Stil von Anki: Karte zeigen, umdrehen, mit 1–4 bewerten. */
export function Review({ lectureId, deckName }: { lectureId?: string; deckName?: string }) {
  const [cards, setCards] = useState<CardState[] | null>(null);
  const [newLeft, setNewLeft] = useState(0);
  const [current, setCurrent] = useState<CardState | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [history, setHistory] = useState<{ before: CardState; newLeftBefore: number }[]>([]);
  const shownAt = useRef(Date.now());

  const pick = useCallback((list: CardState[], left: number) => {
    const { card } = nextCard(list, left);
    setCurrent(card);
    setFlipped(false);
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    (async () => {
      const [list, left] = await Promise.all([
        lectureId ? cardsForLecture(lectureId) : allCards(),
        newCardsLeftToday(getSettings().newPerDay),
      ]);
      setCards(list);
      setNewLeft(left);
      pick(list, left);
    })();
  }, [lectureId, pick]);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || !cards || !flipped) return;
      const updated = schedule(current, rating);
      const left = current.queue === "new" ? newLeft - 1 : newLeft;
      await saveCard(updated);
      await logReview({
        cardId: current.id,
        lectureId: current.lectureId,
        rating,
        queueBefore: current.queue,
        at: Date.now(),
        ms: Date.now() - shownAt.current,
      });
      const list = cards.map((c) => (c.id === updated.id ? updated : c));
      setHistory((h) => [...h, { before: current, newLeftBefore: newLeft }]);
      setCards(list);
      setNewLeft(left);
      setDone((d) => d + 1);
      pick(list, left);
    },
    [current, cards, flipped, newLeft, pick],
  );

  // Rückgängig wie Ankis Strg+Z: stellt die letzte Karte wieder her.
  const undo = useCallback(async () => {
    const last = history.at(-1);
    if (!last || !cards) return;
    await saveCard(last.before);
    const list = cards.map((c) => (c.id === last.before.id ? last.before : c));
    setCards(list);
    setNewLeft(last.newLeftBefore);
    setHistory((h) => h.slice(0, -1));
    setDone((d) => d - 1);
    setCurrent(last.before);
    setFlipped(true);
  }, [history, cards]);

  const suspend = useCallback(async () => {
    if (!current || !cards) return;
    const updated = { ...current, suspended: true };
    await saveCard(updated);
    const list = cards.map((c) => (c.id === updated.id ? updated : c));
    setCards(list);
    pick(list, newLeft);
  }, [current, cards, newLeft, pick]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        rate(Number(e.key) as Rating);
      } else if (flipped && e.key === " ") {
        e.preventDefault();
        rate(3);
      } else if (e.key === "@" || (e.key === "-" && !e.ctrlKey)) {
        suspend();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, rate, undo, suspend]);

  if (!cards) return <p className="muted">Lade Karten …</p>;

  const counts = countDue(cards, newLeft);

  if (!current) {
    const upcoming = cards.filter((c) => !c.suspended && c.queue !== "new").sort((a, b) => a.due - b.due)[0];
    return (
      <div className="study">
        <div className="sheet done-card">
          <h2>{done > 0 ? "Geschafft für heute" : "Gerade nichts fällig"}</h2>
          <p className="muted">
            {done > 0 ? `Du hast ${done} ${done === 1 ? "Karte" : "Karten"} wiederholt. ` : ""}
            {upcoming
              ? `Die nächste Wiederholung ist in ${formatInterval(Math.max(0, upcoming.due - Date.now()))} fällig.`
              : "Lade eine Vorlesung hoch, um neue Karten zu bekommen."}
            {counts.new === 0 && cards.some((c) => c.queue === "new" && !c.suspended)
              ? " Das Tageslimit für neue Karten ist erreicht; du kannst es in der Statistik anpassen."
              : ""}
          </p>
          <div className="row" style={{ marginTop: 20 }}>
            <Link className="btn" href={lectureId ? `/vorlesung?id=${lectureId}` : "/"}>
              {lectureId ? "Zur Vorlesung" : "Zu den Vorlesungen"}
            </Link>
            {history.length > 0 && (
              <button className="btn btn-quiet" onClick={undo}>
                Letzte Bewertung rückgängig
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isNew = current.queue === "new";

  return (
    <div className="study">
      <div className="study-head">
        <span className="muted small">{deckName ?? "Alle Vorlesungen"}</span>
        <Counts counts={counts} />
      </div>

      {/* key: neue Karte wird frisch montiert, damit beim Zurückdrehen keine Antwort aufblitzt */}
      <div
        key={current.id}
        className={`flip ${flipped ? "is-flipped" : ""}`}
        onClick={() => !flipped && setFlipped(true)}
        style={{ cursor: flipped ? "default" : "pointer" }}
      >
        <div className="flip-inner">
          <article className="index-card front" aria-hidden={flipped}>
            <div className="card-topic">
              <span>{current.topic}</span>
              <span>{isNew ? "Neu" : KIND_LABEL[current.kind]}</span>
            </div>
            <div className="card-body">
              <Md>{current.front}</Md>
            </div>
          </article>
          <article className="index-card back" aria-hidden={!flipped}>
            <div className="card-topic">
              <span>{current.topic}</span>
              <span>{KIND_LABEL[current.kind]}</span>
            </div>
            <div className="card-body">
              <div className="card-q">
                <Md>{current.front}</Md>
              </div>
              <Md>{current.back}</Md>
            </div>
          </article>
        </div>
      </div>

      <div className="answer-bar">
        {!flipped ? (
          <button className="btn btn-primary reveal" onClick={() => setFlipped(true)}>
            Antwort zeigen <span className="kbd">Leertaste</span>
          </button>
        ) : (
          <div className="ratings" role="group" aria-label="Wie gut wusstest du die Antwort?">
            {([1, 2, 3, 4] as Rating[]).map((r) => (
              <button key={r} className={`rate rate-${r}`} onClick={() => rate(r)}>
                <small>{previewInterval(current, r)}</small>
                {RATING_LABEL[r]}
                <small className="kbd">{r}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="row muted small">
        <button className="btn btn-quiet small" onClick={undo} disabled={!history.length}>
          Rückgängig <span className="kbd">Strg+Z</span>
        </button>
        <button className="btn btn-quiet small" onClick={suspend}>
          Karte zurückstellen <span className="kbd">@</span>
        </button>
        <Link className="btn btn-quiet small" href={`/karten?id=${encodeURIComponent(current.id)}`}>
          Bearbeiten
        </Link>
      </div>
    </div>
  );
}
