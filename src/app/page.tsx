"use client";

import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { LessonPreview } from "@/components/LessonPreview";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { RoomBadge } from "@/components/RoomBadge";
import { TemplateSetup } from "@/components/TemplateSetup";
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
import { usePlanner } from "@/lib/usePlanner";

export default function Today() {
  const p = usePlanner();
  const { now } = p;

  if (!p.loaded) return <p className="muted">Jarvis startet …</p>;

  const courses = knownCourses(p.data, p.lectures.map((l) => l.course));
  const list = occurrences(p.data, addDays(dayStart(now), -4), addDays(now, 120), courses);
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
  const linkGroups = groupLinks(p.links);
  const daily = linkGroups[0];

  return (
    <>
      <header className="jarvis-head">
        <div>
          <p className="jarvis-date">{fmtDay(now)}</p>
          <h1 className="page-title">{greeting(now)}.</h1>
          <p className="lede">{status}</p>
        </div>
        <div className="row">
          <CopyButton text={askJarvisPrompt({ list, tips: advice, now })} label="Wochenplan mit Claude besprechen" />
        </div>
      </header>

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

      <div className="cockpit-grid">
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
                    <span className="countdown" aria-label={`${days} Tage`}>
                      <strong>{days}</strong>
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
                          <span className="bar">
                            <span style={{ width: `${r.pct}%` }} />
                          </span>
                          {r.pct} % sicher
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
