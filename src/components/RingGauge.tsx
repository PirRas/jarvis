"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessions } from "@/components/FocusStats";
import { useRemoteRefresh } from "@/components/SyncBadge";
import { allCards, listItems, onLocalChange } from "@/lib/db";
import { focusStats, loadSettings } from "@/lib/focus";
import { isMastered } from "@/lib/srs";

const R = 23;
const CIRC = 2 * Math.PI * R;

/** Kleiner Ring-Gauge (Ø 56 px): pct 0–100, Wert in der Mitte, Beschriftung darunter. */
export function RingGauge({ pct, value, label }: { pct: number; value: string; label: string }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="gauge" role="img" aria-label={`${label}: ${value}, ${Math.round(p)} %`}>
      <svg viewBox="0 0 56 56" aria-hidden focusable="false">
        <circle className="gauge-track" cx="28" cy="28" r={R} />
        <circle
          className="gauge-fill"
          cx="28"
          cy="28"
          r={R}
          strokeDasharray={`${(CIRC * p) / 100} ${CIRC}`}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span className="gauge-value">{value}</span>
      <span className="gauge-label">{label}</span>
    </div>
  );
}

/** Lernmonitor: Lernstand (sichere Karten), Lernzeit heute (Tagesziel), erledigte Aufgaben. */
export function LearnMonitor() {
  const sessions = useSessions();
  const [cards, setCards] = useState<Awaited<ReturnType<typeof allCards>>>([]);
  const [todos, setTodos] = useState<Awaited<ReturnType<typeof listItems<"todos">>>>([]);
  const [goal, setGoal] = useState(120);
  const load = useCallback(() => {
    allCards().then(setCards);
    listItems("todos").then(setTodos);
  }, []);
  useEffect(() => {
    setGoal(loadSettings().goal);
    load();
    return onLocalChange(load);
  }, [load]);
  useRemoteRefresh(load);

  const active = cards.filter((c) => !c.suspended);
  const mastered = active.filter(isMastered).length;
  const minutes = sessions ? focusStats(sessions).todayMinutes : 0;
  const done = todos.filter((t) => t.done).length;
  const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

  return (
    <div className="gauges">
      <RingGauge pct={pct(mastered, active.length)} value={`${Math.round(pct(mastered, active.length))} %`} label="Lernstand" />
      <RingGauge pct={pct(minutes, goal)} value={String(minutes)} label="Lernzeit heute (Min.)" />
      <RingGauge pct={pct(done, todos.length)} value={`${done}/${todos.length}`} label="Aufgaben erledigt" />
    </div>
  );
}
