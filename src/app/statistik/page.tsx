"use client";

import { useCallback, useEffect, useState } from "react";
import { useRemoteRefresh } from "@/components/SyncBadge";
import { allCards, getSettings, reviewsSince, setSettings, type ReviewLog } from "@/lib/db";
import { DAY, isMastered, startOfDay, type CardState } from "@/lib/srs";

const WEEKS = 20;

export default function StatsPage() {
  const [cards, setCards] = useState<CardState[]>([]);
  const [reviews, setReviews] = useState<ReviewLog[]>([]);
  const [newPerDay, setNewPerDay] = useState(20);
  const [version, setVersion] = useState(0);
  useRemoteRefresh(useCallback(() => setVersion((v) => v + 1), []));

  useEffect(() => {
    setNewPerDay(getSettings().newPerDay);
    Promise.all([allCards(), reviewsSince(startOfDay() - WEEKS * 7 * DAY)]).then(([c, r]) => {
      setCards(c);
      setReviews(r);
    });
  }, [version]);

  const today0 = startOfDay();
  const todays = reviews.filter((r) => r.at >= today0);
  const correctToday = todays.filter((r) => r.rating > 1).length;
  const minutesToday = Math.round(todays.reduce((s, r) => s + Math.min(r.ms, 60000), 0) / 60000);

  // Lernserie: aufeinanderfolgende Tage mit mindestens einer Wiederholung
  const days = new Set(reviews.map((r) => startOfDay(r.at)));
  let streak = 0;
  for (let d = days.has(today0) ? today0 : today0 - DAY; days.has(d); d -= DAY) streak++;

  // Prognose: fällige Wiederholungen der nächsten 14 Tage
  const active = cards.filter((c) => !c.suspended && c.queue !== "new");
  const forecast = Array.from({ length: 14 }, (_, i) => {
    const from = i === 0 ? -Infinity : today0 + i * DAY;
    const to = today0 + (i + 1) * DAY;
    return active.filter((c) => c.due >= from && c.due < to).length;
  });
  const maxF = Math.max(1, ...forecast);

  // Kalender-Heatmap
  const perDay = new Map<number, number>();
  for (const r of reviews) perDay.set(startOfDay(r.at), (perDay.get(startOfDay(r.at)) ?? 0) + 1);
  const first = today0 - (WEEKS * 7 - 1) * DAY;
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = first + i * DAY;
    const n = perDay.get(d) ?? 0;
    return { d, n, l: n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4 };
  });

  const state = {
    neu: cards.filter((c) => c.queue === "new" && !c.suspended).length,
    lernphase: cards.filter((c) => c.queue === "learning" && !c.suspended).length,
    jung: cards.filter((c) => c.queue === "review" && !isMastered(c) && !c.suspended).length,
    sicher: cards.filter((c) => isMastered(c) && !c.suspended).length,
    zurückgestellt: cards.filter((c) => c.suspended).length,
  };

  const weekday = (d: number) => new Date(d).toLocaleDateString("de-DE", { weekday: "short" });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Statistik</h1>
          <p className="lede">Wie viel du lernst und was in den nächsten Tagen auf dich zukommt.</p>
        </div>
      </div>

      <div className="stats-grid">
        <section className="sheet stat-panel">
          <h2>Heute</h2>
          <div className="big-number">{todays.length}</div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Karten in {minutesToday} Min.
            {todays.length > 0 && `, ${Math.round((correctToday / todays.length) * 100)} % gewusst`}
          </p>
        </section>
        <section className="sheet stat-panel">
          <h2>Lernserie</h2>
          <div className="big-number">{streak}</div>
          <p className="muted" style={{ marginBottom: 0 }}>{streak === 1 ? "Tag" : "Tage"} in Folge gelernt</p>
        </section>
        <section className="sheet stat-panel">
          <h2>Kartenstand</h2>
          {Object.entries(state).map(([k, v]) => (
            <div className="legend-row" key={k}>
              <span style={{ textTransform: "capitalize" }}>{k}</span>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{v}</strong>
            </div>
          ))}
        </section>
      </div>

      <section className="sheet stat-panel" style={{ marginTop: 20 }}>
        <h2>Fällige Wiederholungen, nächste 14 Tage</h2>
        <div className="forecast" role="img" aria-label={`Prognose: ${forecast.join(", ")}`}>
          {forecast.map((n, i) => (
            <div className="forecast-col" key={i} title={`${n} Karten`}>
              <span>{n || ""}</span>
              <div className="forecast-bar" style={{ height: `${(n / maxF) * 110}px` }} />
              <span>{i === 0 ? "heute" : weekday(today0 + i * DAY)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sheet stat-panel" style={{ marginTop: 20 }}>
        <h2>Lernkalender</h2>
        <div className="heat">
          {cells.map((c) => (
            <span
              key={c.d}
              data-l={c.l}
              title={`${new Date(c.d).toLocaleDateString("de-DE")}: ${c.n} Karten`}
            />
          ))}
        </div>
      </section>

      <section className="sheet stat-panel" style={{ marginTop: 20, maxWidth: 520 }}>
        <h2>Einstellungen</h2>
        <label className="field">
          Neue Karten pro Tag
          <input
            type="number"
            min={0}
            max={500}
            value={newPerDay}
            onChange={(e) => {
              const v = Math.max(0, Math.min(500, Number(e.target.value) || 0));
              setNewPerDay(v);
              setSettings({ newPerDay: v });
            }}
          />
        </label>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Wie bei Anki: Ein Limit verhindert, dass sich Wiederholungen aufstauen. Vor der Prüfung kannst du es erhöhen.
        </p>
      </section>
    </>
  );
}
