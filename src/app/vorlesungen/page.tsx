"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Counts as CountsView } from "@/components/Counts";
import { Importer } from "@/components/Importer";
import { useRemoteRefresh } from "@/components/SyncBadge";
import { groupByCourse } from "@/lib/courses";
import { allCards, getSettings, listLectures, newCardsLeftToday, saveLecture, type Lecture } from "@/lib/db";
import { SAMPLE_NOTES, SAMPLE_STUDY } from "@/lib/sample";
import { countDue, isMastered, type CardState } from "@/lib/srs";

export default function Library() {
  const [lectures, setLectures] = useState<Lecture[] | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [newLeft, setNewLeft] = useState(20);

  const load = useCallback(async () => {
    const [l, c, n] = await Promise.all([listLectures(), allCards(), newCardsLeftToday(getSettings().newPerDay)]);
    setLectures(l);
    setCards(c);
    setNewLeft(n);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useRemoteRefresh(load);

  async function addSample() {
    await saveLecture({
      id: crypto.randomUUID(),
      fileName: "beispiel.pdf",
      createdAt: Date.now(),
      title: SAMPLE_NOTES.title,
      course: SAMPLE_NOTES.course,
      notes: SAMPLE_NOTES,
      study: SAMPLE_STUDY,
    });
    load();
  }

  // Gleiche Lehrveranstaltung in leicht anderer Schreibweise landet unter einem Reiter.
  const groups = groupByCourse(lectures ?? []);

  const total = countDue(cards, newLeft);
  const anything = total.new + total.learning + total.review > 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Deine Vorlesungen</h1>
          <p className="lede">
            Füge nach jeder Vorlesung die Folien hinzu. Du bekommst eine vollständige Nachbereitung und lernst den Stoff
            danach mit Karteikarten und Quiz, bis er sitzt.
          </p>
        </div>
        {lectures && lectures.length > 0 && (
          <div className="row">
            <CountsView counts={total} />
            <Link href="/lernen" className={`btn ${anything ? "btn-primary" : ""}`}>
              {anything ? "Alle fälligen Karten lernen" : "Für heute fertig"}
            </Link>
          </div>
        )}
      </div>

      <Importer />

      {lectures && lectures.length === 0 && (
        <div className="sheet empty" style={{ marginTop: 32 }}>
          <h2>Noch keine Vorlesung hochgeladen</h2>
          <p className="muted" style={{ maxWidth: "56ch" }}>
            Füge oben deine erste Vorlesung hinzu. Du willst erst sehen, wie das Ergebnis aussieht? Dann lade eine kurze
            Beispielvorlesung zur Mikroökonomie.
          </p>
          <button className="btn" onClick={addSample}>
            Beispielvorlesung laden
          </button>
        </div>
      )}

      {lectures && lectures.length > 0 && (
        <div className="library">
          {groups.map(({ name: course, items: list }) => (
            <section key={course}>
              <h2 className="course-title">
                {course}
                <span className="muted small" style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}>
                  {list.length} {list.length === 1 ? "Vorlesung" : "Vorlesungen"}
                </span>
              </h2>
              <ul className="deck-list sheet">
                {list.map((l) => {
                  const deck = cards.filter((c) => c.lectureId === l.id);
                  const active = deck.filter((c) => !c.suspended);
                  const mastered = active.filter(isMastered).length;
                  const pct = active.length ? Math.round((mastered / active.length) * 100) : 0;
                  return (
                    <li className="deck" key={l.id}>
                      <div>
                        <Link className="deck-name" href={`/vorlesung?id=${l.id}`}>
                          {l.title}
                        </Link>
                        <div className="deck-meta">
                          {new Date(l.createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" })},{" "}
                          {l.notes.slides.length} Folien, {deck.length} Karten, {l.study.quiz.length} Quizfragen
                        </div>
                      </div>
                      <div className="mastery" title="Anteil der Karten mit einem Intervall von mindestens 3 Wochen">
                        <div className="bar">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        {pct} % sicher
                      </div>
                      <Link href={`/lernen?deck=${l.id}`} className="counts" style={{ textDecoration: "none" }} aria-label="Karten dieses Stapels lernen">
                        <CountsView counts={countDue(deck, newLeft)} bare />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
