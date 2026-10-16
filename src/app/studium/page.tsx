"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DatesView, SemesterCard, upcomingDeadlines } from "@/components/studium/DatesView";
import { NewsView } from "@/components/studium/NewsView";
import { PlanView } from "@/components/studium/PlanView";
import type { CourseRecord, NewsFeed } from "@/lib/assistant";
import { listItems, onLocalChange } from "@/lib/db";
import { fmtShortDay, parseIsoDate, relDay } from "@/lib/planner";
import { FAMULATUR_ID, PLAN, STAGE_KP, summarize, TOTAL_KP, type PlanCourse, type Result } from "@/lib/studyPlan";
import { REMOTE_CHANGE_EVENT } from "@/lib/sync";
import "./studium.css";

type Tab = "overview" | "plan" | "dates" | "news";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Überblick" },
  { id: "plan", label: "Studienplan & Noten" },
  { id: "dates", label: "Fristen" },
  { id: "news", label: "Neuigkeiten" },
];
const TAB_KEY = "studium-tab";

export default function StudiumPage() {
  const [records, setRecords] = useState<CourseRecord[]>([]);
  const [feeds, setFeeds] = useState<NewsFeed[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [g, n] = await Promise.all([listItems("grades"), listItems("news")]);
    setRecords(g);
    setFeeds(n.sort((a, b) => a.createdAt - b.createdAt));
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    try {
      const t = localStorage.getItem(TAB_KEY) as Tab | null;
      if (t && TABS.some((x) => x.id === t)) setTab(t);
    } catch {
      // ohne Speicher startet die Seite im Überblick
    }
    const off = onLocalChange(load);
    window.addEventListener(REMOTE_CHANGE_EVENT, load);
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      off();
      window.removeEventListener(REMOTE_CHANGE_EVENT, load);
      clearInterval(tick);
    };
  }, [load]);

  function choose(t: Tab) {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // egal
    }
  }

  const { results, extras } = useMemo(() => {
    const results = new Map<string, Result>(records.map((r) => [r.id, { id: r.id, status: r.status, grade: r.grade }]));
    const extras: PlanCourse[] = records
      .filter((r) => r.id.startsWith("wahl-"))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        id: r.id,
        stage: "Wahlbereich",
        module: "Wahlbereich",
        course: r.course,
        semester: r.semester,
        kp: r.kp,
        assessment: r.assessment,
      }));
    return { results, extras };
  }, [records]);
  const summary = useMemo(() => summarize(PLAN, results, extras), [results, extras]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Studium</h1>
          <p className="lede">
            Kreditpunkte, Noten, Fristen und Neuigkeiten im Bachelor Pharmazeutische Wissenschaften, nach Wegleitung (ab HS
            2025) und Bachelor-Ordnung der Phil.-Nat. Fakultät.
          </p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => choose(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <p className="muted">Lade …</p>
      ) : tab === "overview" ? (
        <Overview summary={summary} records={records} now={now} go={choose} />
      ) : tab === "plan" ? (
        <PlanView records={records} results={results} extras={extras} summary={summary} />
      ) : tab === "dates" ? (
        <DatesView now={now} />
      ) : (
        <NewsView feeds={feeds} />
      )}
    </>
  );
}

function Overview({
  summary,
  records,
  now,
  go,
}: {
  summary: ReturnType<typeof summarize>;
  records: CourseRecord[];
  now: number;
  go: (t: Tab) => void;
}) {
  const g = summary.byStage.Grundstudium;
  const deadlines = upcomingDeadlines(now, 120).slice(0, 3);
  const famulatur = records.some((r) => r.id === FAMULATUR_ID && r.status === "bestanden");
  const pct = (a: number, b: number) => `${Math.min(100, Math.round((a / b) * 100))}%`;

  return (
    <div className="st-overview">
      <section className="sheet panel st-kp">
        <h2 className="panel-title">Kreditpunkte</h2>
        <p className="st-big">
          {summary.earned} <span className="muted">/ {TOTAL_KP} KP</span>
        </p>
        <div className="bar" aria-label={`${summary.earned} von ${TOTAL_KP} KP`}>
          <span style={{ width: pct(summary.earned, TOTAL_KP) }} />
        </div>
        <ul className="st-stages">
          {(Object.keys(STAGE_KP) as (keyof typeof STAGE_KP)[]).map((s) => (
            <li key={s}>
              <span>{s}</span>
              <span className="st-stage-bar bar">
                <span style={{ width: pct(summary.byStage[s].earned, summary.byStage[s].total) }} />
              </span>
              <span className="small">
                {summary.byStage[s].earned}/{summary.byStage[s].total}
                {summary.byStage[s].grade !== null && <> · Note {summary.byStage[s].grade!.toFixed(2)}</>}
              </span>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Das Grundstudium ({g.total} KP) soll innert einem Jahr abgeschlossen sein. Fehlen KP, kannst du ins Aufbaustudium,
          musst sie aber innerhalb eines Jahres nachholen.
        </p>
        <button className="btn btn-quiet" onClick={() => go("plan")}>
          Noten eintragen
        </button>
      </section>

      <SemesterCard now={now} />

      <section className="sheet panel">
        <h2 className="panel-title">Nächste Fristen</h2>
        {deadlines.length ? (
          <ul className="st-mini">
            {deadlines.map((d) => (
              <li key={d.id}>
                <strong>{fmtShortDay(parseIsoDate(d.date))}</strong> {d.title}
                {d.estimated && <span className="pill st-pill-est">geschätzt</span>}
                <span className="small muted"> · {relDay(parseIsoDate(d.date), now)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Keine Fristen in den nächsten Monaten.</p>
        )}
        <button className="btn btn-quiet" onClick={() => go("dates")}>
          Alle Fristen
        </button>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">Nachweise</h2>
        <p className="small" style={{ margin: 0 }}>
          Famulatur: {famulatur ? <strong className="st-ok">erledigt</strong> : <strong>noch offen</strong>}
          <span className="muted">: Pflicht bis zum Bachelorabschluss (2 Wochen Apotheke).</span>
        </p>
        <p className="small" style={{ marginBottom: 0 }}>
          Wahlbereich: {summary.byStage.Wahlbereich.earned} von 9 KP
        </p>
      </section>
    </div>
  );
}
