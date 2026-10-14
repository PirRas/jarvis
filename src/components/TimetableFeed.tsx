"use client";

import { useState } from "react";
import { deleteFeedCache, deleteItems, putItem } from "@/lib/db";
import { fetchFeed, FEEDS_EVENT } from "@/lib/feeds";
import { fmtShortDay, fmtTime, type Feed, type FeedCache } from "@/lib/planner";
import { deriveTimetable, hasUpcomingLessons, isTimetableUrl, TIMETABLE_FEED_ID, TIMETABLE_FEED_NAME } from "@/lib/timetable";

export function timetableFeed(feeds: Feed[]) {
  return feeds.find((f) => f.role === "timetable");
}

/** Stundenplan-Abo der Uni Basel verbinden, Status zeigen und für ein neues Semester einen neuen Link einsetzen. */
export function TimetableFeed({ feeds, caches, now }: { feeds: Feed[]; caches: FeedCache[]; now: number }) {
  const feed = timetableFeed(feeds);
  const cache = feed && caches.find((c) => c.id === feed.id);
  const [url, setUrl] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    const u = url.trim();
    if (!isTimetableUrl(u)) {
      setError("Das ist keine Stundenplan-Adresse der Uni Basel. Sie beginnt mit webcal://unical.unibas.ch/feed/…");
      return;
    }
    setBusy(true);
    setError(null);
    const next: Feed = {
      id: feed?.id ?? TIMETABLE_FEED_ID,
      name: TIMETABLE_FEED_NAME,
      url: u,
      role: "timetable",
      createdAt: feed?.createdAt ?? Date.now(),
    };
    await putItem("feeds", next);
    await fetchFeed(next);
    window.dispatchEvent(new Event(FEEDS_EVENT));
    setBusy(false);
    setUrl("");
    setEditing(false);
  }

  async function refresh() {
    if (!feed) return;
    setBusy(true);
    await fetchFeed(feed);
    window.dispatchEvent(new Event(FEEDS_EVENT));
    setBusy(false);
  }

  async function disconnect() {
    if (!feed || !confirm("Stundenplan-Abo trennen? Die bisherigen Einträge bleiben, werden aber nicht mehr aktualisiert.")) return;
    await deleteItems("feeds", [feed.id]);
    await deleteFeedCache(feed.id);
  }

  const form = (
    <div className="tt-form">
      <label className="field">
        <span>Abo-Adresse aus den Online-Services</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="webcal://unical.unibas.ch/feed/…"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="row">
        <button className="btn btn-primary" onClick={connect} disabled={busy || !url.trim()}>
          {busy ? "Lade Stundenplan …" : feed ? "Link ersetzen" : "Verbinden"}
        </button>
        {feed && (
          <button className="btn btn-quiet" onClick={() => setEditing(false)}>
            Abbrechen
          </button>
        )}
      </div>
      {error && <p className="error small">{error}</p>}
    </div>
  );

  if (!feed) {
    return (
      <section className="sheet panel tt">
        <h2 className="panel-title">Stundenplan automatisch aus den Online-Services</h2>
        <p className="muted small">
          In den Online-Services (services.unibas.ch) gibt es beim Stundenplan ein Kalender-Abo. Füge die Adresse hier ein:
          Jarvis baut daraus deinen Stundenplan mit Räumen und trägt die Prüfungen ein. Belegst du etwas neu oder ändert
          sich ein Raum, kommt das beim nächsten Abruf von selbst.
        </p>
        {form}
      </section>
    );
  }

  const events = cache?.events ?? [];
  const { slots, exams } = deriveTimetable(events, now);
  const stale = !!cache && !cache.error && !hasUpcomingLessons(events, now);

  return (
    <section className={`sheet panel tt ${stale || cache?.error ? "tt-warn" : ""}`}>
      <div className="row spread">
        <h2 className="panel-title">Stundenplan-Abo</h2>
        <div className="row">
          <button className="btn btn-quiet" onClick={refresh} disabled={busy}>
            {busy ? "Lade …" : "Jetzt aktualisieren"}
          </button>
          <button className="btn btn-quiet" onClick={() => setEditing((v) => !v)}>
            Neuer Link
          </button>
          <button className="btn btn-quiet" onClick={disconnect}>
            Trennen
          </button>
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {cache?.fetchedAt
          ? `${slots.length} Kurse pro Woche, ${exams.length} Prüfungen · zuletzt geladen ${fmtShortDay(cache.fetchedAt)}, ${fmtTime(cache.fetchedAt)}`
          : "Noch nicht geladen."}{" "}
        Jarvis lädt das Abo beim Öffnen und alle paar Stunden neu.
      </p>
      {cache?.error && <p className="error small">{cache.error}</p>}
      {stale && (
        <p className="tt-hint small">
          Im Abo stehen keine kommenden Lektionen mehr. Beginnt ein neues Semester, kopiere in den Online-Services die neue
          Abo-Adresse und setze sie über „Neuer Link“ ein.
        </p>
      )}
      {editing && form}
    </section>
  );
}
