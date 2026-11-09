"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Decode, shouldBoot } from "@/components/Decode";
import { CountUp } from "@/components/CountUp";
import { CopyButton } from "@/components/CopyButton";
import { HudRing } from "@/components/HudRing";
import { LearnMonitor } from "@/components/RingGauge";
import { SystemStatus } from "@/components/SystemStatus";
import { LessonPreview } from "@/components/LessonPreview";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { RoomBadge } from "@/components/RoomBadge";
import { TemplateSetup } from "@/components/TemplateSetup";
import { SplitFlap } from "@/components/SplitFlap";
import { TimetableFeed, timetableFeed } from "@/components/TimetableFeed";
import { hasUpcomingLessons } from "@/lib/timetable";
import { askJarvisPrompt, greeting, latestLecture, readiness, tips } from "@/lib/jarvis";
import {
  addDays,
  dayStart,
  DAYMS,
  fmtDay,
  fmtShortDay,
  fmtTime,
  groupLinks,
  knownCourses,
  nowAndNext,
  occurrences,
  previewId,
  relDay,
  relTime,
  type Occurrence,
} from "@/lib/planner";
import { PushSetup } from "@/components/PushSetup";
import { TodoItem } from "@/components/TodoItem";
import { examPlans, pendingPrep } from "@/lib/lernplan";
import { sessionsIn } from "@/lib/prepPlan";
import { PrepMoves } from "@/components/PrepPlan";
import { groupTodos } from "@/lib/todos";
import { levelLabel, readProfile, semesterAt, semesterLabel, studyLevel } from "@/lib/profile";
import { usePlanner } from "@/lib/usePlanner";

export default function Today() {
  const p = usePlanner();
  const [boot] = useState(shouldBoot);
  const router = useRouter();
  const { now } = p;

  // Beim ersten Öffnen in dieser Browser-Sitzung zuerst der Jarvis-Sprachbildschirm
  useEffect(() => {
    // Merker für die Startseite: wer die App schon nutzt, landet direkt hier statt auf der Infoseite (LandingRedirect)
    localStorage.setItem("jarvis-app", "1");
    if (sessionStorage.getItem("jarvis-intro") || localStorage.getItem("jarvis-start") === "0") return;
    sessionStorage.setItem("jarvis-intro", "1");
    router.replace("/jarvis");
  }, [router]);

  if (!p.loaded) return <p className="muted">Jarvis startet …</p>;

  const courses = knownCourses(p.data, p.lectures.map((l) => l.course));
  const list = [...occurrences(p.data, addDays(dayStart(now), -4), addDays(now, 120), courses), ...sessionsIn(p.prep, addDays(dayStart(now), -4), addDays(now, 120))].sort(
    (a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay),
  );
  const { current, next } = nowAndNext(list, now);
  const advice = tips({ list, lectures: p.lectures, cards: p.cards, previews: p.previews, newLeft: p.newLeft, now });

  // Tagesliste: heute, oder der nächste Tag mit Einträgen, wenn heute nichts mehr kommt
  const today = list.filter((o) => o.start < dayStart(addDays(now, 1)) && o.end > dayStart(now));
  const todayLeft = today.filter((o) => o.end > now);
  const nextDayStart = todayLeft.length
    ? dayStart(now)
    : (list.find((o) => o.start >= dayStart(addDays(now, 1))) ?? null)?.start;
  const agendaDay = nextDayStart ? dayStart(nextDayStart) : null;
  const agenda = agendaDay ? list.filter((o) => o.start < agendaDay + DAYMS && o.end > agendaDay) : [];

  const upcoming = list.filter((o) => (o.kind === "exam" || o.kind === "deadline") && o.end > now).slice(0, 8);
  const nextExam = upcoming.find((o) => o.kind === "exam");
  const lessonsLeft = todayLeft.filter((o) => o.kind === "lecture").length;

  const status = [
    lessonsLeft ? `Heute noch ${lessonsLeft} ${lessonsLeft === 1 ? "Lektion" : "Lektionen"}.` : "Heute keine Lektionen mehr.",
    nextExam ? `Nächste Prüfung ${relDay(nextExam.start, now)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const focus = [...current, ...(next ? [next] : [])];

  // Aufgaben: überfällige und die nächsten zuerst
  const openTodos = groupTodos(p.todos, now)
    .filter((g) => g.key !== "done")
    .flatMap((g) => g.items)
    .slice(0, 5);
  // Lernplan
  const lite = p.lectures.map((l) => ({ id: l.id, course: l.course, title: l.title, createdAt: l.createdAt, examTasks: l.study.exam_tasks.length }));
  const pending = pendingPrep(p.data, lite, p.marks, now);
  const plans = examPlans(p.data, lite, p.cards, p.marks, now).filter((x) => x.daysLeft <= 60);
  const newToday = plans.reduce((sum, x) => sum + x.daily.newCards, 0);
  const reviewsToday = plans.reduce((sum, x) => sum + x.daily.reviews, 0);
  const profile = readProfile(p.marks);
  const linkGroups = groupLinks(p.links);
  const daily = linkGroups[0];

  return (
    <>
      {p.data.slots.length === 0 && !timetableFeed(p.data.feeds) && (
        <>
          <TimetableFeed feeds={p.data.feeds} caches={p.data.caches} now={p.now} />
          <details className="sheet panel" style={{ marginBottom: 24 }}>
            <summary>Ohne Abo: Vorlage des Departements verwenden</summary>
            <TemplateSetup compact />
          </details>
        </>
      )}

      <TimetableNotice p={p} />
      <PrepMoves p={p} compact />

      <div className="home-grid">
        <div className="home-main">
          <header className={`jarvis-head${boot ? " is-boot" : ""}`}>
            <HudRing boot={boot}>
              <span className="hud-time">
                <SplitFlap value={fmtTime(now)} />
              </span>
              <span className="hud-day">{new Date(now).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}</span>
            </HudRing>
            <div className="jarvis-head-text">
              <h1 className="page-title">
                <Decode text={`${greeting(now)}${profile?.name ? `, ${profile.name}` : ""}.`} active={boot} />
              </h1>
              <p className="hud-tags">
                {profile && <span className="hud-tag is-level">{levelLabel(studyLevel(profile, now))}</span>}
                {profile?.program && <span className="hud-tag">{profile.program}</span>}
                <span className="hud-tag">{semesterLabel(semesterAt(now))}</span>
                {!profile && (
                  <Link className="hud-tag is-action" href="/konto#profil">
                    Name und Studiengang eintragen
                  </Link>
                )}
              </p>
              <p className="lede">{status}</p>
              <div className="row">
                <CopyButton text={askJarvisPrompt({ list, tips: advice, now })} label="Wochenplan mit Claude besprechen" />
              </div>
            </div>
          </header>

          <section id="als-naechstes" className="nextup-wrap">
            {focus.length === 0 ? (
              <div className="sheet nextup">
                <p className="nextup-label">Als Nächstes</p>
                <h2 className="nextup-title">Nichts mehr geplant</h2>
                <p className="muted">
                  Trag deinen <Link href="/stundenplan">Stundenplan</Link> ein oder abonniere deinen{" "}
                  <Link href="/kalender">ADAM-Kalender</Link>, dann zeigt dir Jarvis hier immer die nächste Lektion.
                </p>
              </div>
            ) : (
              focus.map((o) => (
                <NextUp
                  key={o.key}
                  o={o}
                  now={now}
                  live={o.start <= now}
                  preview={p.previews.find((x) => x.id === previewId(o.course, o.start))}
                  last={latestLecture(o.course, p.lectures)}
                />
              ))
            )}
          </section>

          <PushSetup marks={p.marks} compact />
        </div>
        <div className="home-col home-left">
          <section className="sheet panel">
            <h2 className="panel-title">Lernmonitor</h2>
            <LearnMonitor />
            <Link className="panel-more" href="/statistik">
              Statistik
            </Link>
          </section>

          <section className="sheet panel">
            <h2 className="panel-title">Aufgaben</h2>
            {openTodos.length ? (
              <ul className="todo-list todo-compact">
                {openTodos.map((t) => (
                  <TodoItem key={t.id} todo={t} now={now} compact />
                ))}
              </ul>
            ) : (
              <p className="muted">Keine offenen Aufgaben.</p>
            )}
            <Link className="panel-more" href="/aufgaben">
              Alle Aufgaben
            </Link>
          </section>

          <section className="sheet panel">
            <h2 className="panel-title">Lernplan heute</h2>
            <ul className="lp-today-list">
              {p.prep.backlog.length > 0 && (
                <li>
                  <Link href="/lernplan#nachbereitung">
                    Rückstand: <CountUp value={p.prep.backlog.length} /> Vorlesungen
                  </Link>
                  {p.prep.catchUp && <span className="small muted"> · aufgeholt bis {fmtShortDay(p.prep.catchUp)}</span>}
                </li>
              )}
              {pending.length > 0 && (
                <li>
                  <Link href="/lernplan#waechter">
                    <CountUp value={pending.length} /> {pending.length === 1 ? "Lektion" : "Lektionen"} nachbereiten
                  </Link>
                  <span className="small muted"> · {[...new Set(pending.map((o) => o.course))].slice(0, 3).join(", ")}</span>
                </li>
              )}
              {newToday + reviewsToday > 0 && (
                <li>
                  <Link href="/lernen">
                    <CountUp value={newToday} /> neue Karten, <CountUp value={reviewsToday} /> Wiederholungen
                  </Link>
                </li>
              )}
              {plans[0] && (
                <li>
                  Nächste Prüfung: <strong>{plans[0].course}</strong> in <CountUp value={plans[0].daysLeft} /> Tagen, <CountUp value={plans[0].readiness} /> % bereit
                </li>
              )}
              {!pending.length && newToday + reviewsToday === 0 && !plans[0] && <li className="muted">Nichts offen.</li>}
            </ul>
            <Link className="panel-more" href="/lernplan">
              Ganzer Lernplan
            </Link>
          </section>
        </div>
        <div className="home-col home-right">
          <section className="sheet panel">
            <h2 className="panel-title">
              {agendaDay === dayStart(now) ? "Heute" : agendaDay ? fmtDay(agendaDay) : "Heute"}
            </h2>
            {agenda.length ? (
              <ul className="occ-list">
                {agenda.map((o) => (
                  <OccurrenceRow key={o.key} o={o} now={now} />
                ))}
              </ul>
            ) : (
              <p className="muted">Keine Einträge.</p>
            )}
            <Link className="panel-more" href="/kalender">
              Ganzer Kalender
            </Link>
          </section>

          <section className="sheet panel">
            <h2 className="panel-title">Jarvis empfiehlt</h2>
            {advice.length ? (
              <ul className="tips">
                {advice.slice(0, 7).map((t) => (
                  <li key={t.id} className={`tip tone-${t.tone}`}>
                    <span>{t.text}</span>
                    {t.href &&
                      (t.href.startsWith("http") ? (
                        <a href={t.href} target="_blank" rel="noreferrer" className="tip-action">
                          {t.action}
                        </a>
                      ) : (
                        <Link href={t.href} className="tip-action">
                          {t.action}
                        </Link>
                      ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Alles erledigt. Gönn dir eine Pause.</p>
            )}
          </section>

          <section className="sheet panel">
            <h2 className="panel-title">Prüfungen und Fristen</h2>
            {upcoming.length ? (
              <ul className="exam-list">
                {upcoming.map((o) => {
                  const r = o.kind === "exam" ? readiness(o.course, p.lectures, p.cards, p.newLeft) : null;
                  const days = Math.round((dayStart(o.start) - dayStart(now)) / DAYMS);
                  return (
                    <li key={o.key} className={`exam kind-${o.kind}`}>
                      <span className="countdown">
                        <strong>
                          <CountUp value={days} />
                        </strong>
                        <span>{days === 1 ? "Tag" : "Tage"}</span>
                      </span>
                      <span className="exam-body">
                        <span className="exam-title">{o.title}</span>
                        <span className="small muted">
                          {fmtShortDay(o.start)}
                          {!o.allDay && `, ${fmtTime(o.start)}`}
                          {o.kind === "deadline" ? " · Frist" : ""}
                        </span>
                        {r && r.cards > 0 && (
                          <span className="mastery small">
                            <span className="bar" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Sicher gelernt">
                              <span style={{ width: `${r.pct}%` }} />
                            </span>
                            {r.pct} % sicher
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">
                Keine eingetragen. <Link href="/kalender">Prüfungstermine hinzufügen</Link>
              </p>
            )}
          </section>

          <SystemStatus />
        </div>
        <div className="home-bottom">
          <section className="sheet panel">
            <h2 className="panel-title">Uni-Mail</h2>
            <p className="muted small" style={{ marginTop: 0 }}>
              Jarvis prüft dein Uni-Postfach über Claude und meldet hier, welche Mails eine Antwort brauchen. Termine aus
              Mails landen automatisch im Kalender.
            </p>
            <a className="btn" href="https://outlook.office.com/mail/" target="_blank" rel="noreferrer">
              Outlook öffnen
            </a>
          </section>

          {daily && (
            <nav className="quick-tiles" aria-label="Schnellzugriff">
              {daily.items.map((l) => (
                <a key={l.id} className="tile" href={l.url} target="_blank" rel="noreferrer">
                  {l.name}
                </a>
              ))}
              <Link className="tile tile-more" href="/links">
                Alle Links
              </Link>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}

function NextUp({
  o,
  now,
  live,
  preview,
  last,
}: {
  o: Occurrence;
  now: number;
  live: boolean;
  preview: Parameters<typeof LessonPreview>[0]["preview"];
  last: ReturnType<typeof latestLecture>;
}) {
  return (
    <article className={`sheet nextup ${live ? "is-live" : ""}`}>
      <div className="nextup-top">
        <p className="nextup-label">
          {live ? `Läuft gerade, bis ${fmtTime(o.end)}` : `Als Nächstes · ${relTime(o.start, now)}`}
        </p>
        <span className="nextup-when">
          {relDay(o.start, now) === "heute" ? "" : `${fmtShortDay(o.start)}, `}
          {fmtTime(o.start)}–{fmtTime(o.end)}
        </span>
      </div>
      <h2 className="nextup-title">{o.title}</h2>
      <p className="nextup-type">{o.type}</p>
      {o.kind === "lecture" && (
        <div className="nextup-room">
          <RoomBadge occ={o} large />
        </div>
      )}
      {o.kind === "lecture" && !live && <LessonPreview occ={o} preview={preview} />}
      {last && (
        <p className="small" style={{ margin: "14px 0 0" }}>
          Letzte Nachbereitung:{" "}
          <Link href={`/vorlesung?id=${last.id}`}>{last.title}</Link>
        </p>
      )}
    </article>
  );
}

/** Hinweis, wenn das Stundenplan-Abo nicht mehr lädt oder keine Lektionen mehr enthält (neues Semester). */
function TimetableNotice({ p }: { p: ReturnType<typeof usePlanner> }) {
  const feed = timetableFeed(p.data.feeds);
  const cache = feed && p.data.caches.find((c) => c.id === feed.id);
  if (!feed || !cache) return null;
  const empty = !cache.error && !hasUpcomingLessons(cache.events, p.now);
  if (!cache.error && !empty) return null;
  return (
    <p className="sheet panel tt-hint" style={{ marginBottom: 24 }}>
      {cache.error
        ? `Dein Stundenplan-Abo lädt gerade nicht: ${cache.error} `
        : "In deinem Stundenplan-Abo stehen keine kommenden Lektionen mehr. Neues Semester? "}
      <Link href="/stundenplan">Neuen Link einsetzen</Link>
    </p>
  );
}
