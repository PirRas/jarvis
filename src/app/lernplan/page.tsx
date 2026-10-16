"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PrepPlanPanel } from "@/components/PrepPlan";
import { putItems } from "@/lib/db";
import { examPlans, pendingPrep, PHASE_LABEL, weekReview, type ExamPlan } from "@/lib/lernplan";
import { dayStart, DAYMS, fmtShortDay, fmtTime, relDay, type Occurrence } from "@/lib/planner";
import { usePlanner } from "@/lib/usePlanner";

export default function LernplanPage() {
  const p = usePlanner();
  const lectures = useMemo(
    () => p.lectures.map((l) => ({ id: l.id, course: l.course, title: l.title, createdAt: l.createdAt, examTasks: l.study.exam_tasks.length })),
    [p.lectures],
  );
  const plans = useMemo(() => examPlans(p.data, lectures, p.cards, p.marks, p.now), [p.data, lectures, p.cards, p.marks, p.now]);
  const pending = useMemo(() => pendingPrep(p.data, lectures, p.marks, p.now), [p.data, lectures, p.marks, p.now]);
  const review = useMemo(() => weekReview(p.data, lectures, p.marks, p.now), [p.data, lectures, p.marks, p.now]);

  if (!p.loaded) return <p className="muted">Lade …</p>;

  const near = plans.filter((x) => x.daysLeft <= 60);
  const newToday = near.reduce((s, x) => s + x.daily.newCards, 0);
  const reviewsToday = near.reduce((s, x) => s + x.daily.reviews, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Lernplan</h1>
          <p className="lede">
            Jarvis rechnet von deinen Prüfungen rückwärts: Was ist nachbereitet, wie viele Karten sitzen schon, und was
            solltest du heute tun, damit es bis zur Prüfung reicht.
          </p>
        </div>
      </div>

      <section className="sheet panel lp-today">
        <h2 className="panel-title">Heute</h2>
        <ul className="lp-today-list">
          {p.prep.sessions
            .filter((x) => x.start < dayStart(p.now) + DAYMS)
            .map((x) => (
              <li key={x.key}>
                {fmtTime(x.start)}: <strong>{x.title.replace("Nachbereitung: ", "")}</strong> nachbereiten (Vorlesung vom {fmtShortDay(x.lesson.start)}){" "}
                <a href="#nachbereitung">Plan</a>
              </li>
            ))}
          {pending.length > 0 && (
            <li>
              <strong>{pending.length}</strong> {pending.length === 1 ? "Lektion" : "Lektionen"} nachbereiten{" "}
              <a href="#waechter">ansehen</a>
            </li>
          )}
          {newToday + reviewsToday > 0 && (
            <li>
              <strong>{newToday}</strong> neue Karten und <strong>{reviewsToday}</strong> Wiederholungen{" "}
              <Link href="/lernen">jetzt lernen</Link>
            </li>
          )}
          {near
            .filter((x) => x.phase === "endspurt" && x.examTasks)
            .map((x) => (
              <li key={x.exam.key}>
                Probeklausur {x.course}: Klausuraufgaben lösen{" "}
                {x.lectureIds[0] && <Link href={`/vorlesung?id=${x.lectureIds[0]}`}>öffnen</Link>}
              </li>
            ))}
          {pending.length === 0 && newToday + reviewsToday === 0 && <li className="muted">Für heute ist nichts offen.</li>}
        </ul>
      </section>

      <PrepPlanPanel p={p} />

      <h2 className="course-title" style={{ marginTop: 32 }}>
        Prüfungen
      </h2>
      {plans.length === 0 ? (
        <p className="muted">
          Keine Prüfungen eingetragen. Sie kommen aus dem Stundenplan-Abo oder lassen sich im <Link href="/kalender">Kalender</Link>{" "}
          eintragen.
        </p>
      ) : (
        <div className="lp-exams">
          {plans.map((x) => (
            <ExamCard key={x.exam.key} plan={x} />
          ))}
        </div>
      )}

      <section id="waechter" className="sheet panel" style={{ marginTop: 32 }}>
        <h2 className="panel-title">Noch nicht nachbereitet</h2>
        <p className="small muted" style={{ margin: "4px 0 12px" }}>
          Vorlesungen der letzten sieben Tage, zu denen noch keine Nachbereitung gespeichert ist. Übungen zählen nicht.
        </p>
        {pending.length === 0 ? (
          <p className="ok-note">Alles nachbereitet.</p>
        ) : (
          <ul className="lp-pending">
            {pending.map((o) => (
              <PendingRow key={o.key} o={o} now={p.now} />
            ))}
          </ul>
        )}
      </section>

      <section id="rueckblick" className="sheet panel" style={{ marginTop: 24 }}>
        <h2 className="panel-title">Wochenrückblick</h2>
        <div className="lp-stats">
          <div>
            <strong>{review.held}</strong>
            <span className="small muted">Vorlesungen diese Woche</span>
          </div>
          <div>
            <strong>
              {review.prepared}/{review.held}
            </strong>
            <span className="small muted">nachbereitet</span>
          </div>
          <div>
            <strong>{review.newLectures}</strong>
            <span className="small muted">neue Nachbereitungen</span>
          </div>
          <div>
            <strong>{review.nextLectures}</strong>
            <span className="small muted">Lektionen nächste 7 Tage</span>
          </div>
        </div>
        {review.upcoming.length > 0 && (
          <>
            <h3 className="panel-sub">Nächste 7 Tage</h3>
            <ul className="lp-upcoming">
              {review.upcoming.map((o) => (
                <li key={o.key} className={`kind-${o.kind}`}>
                  <span className="small">{fmtShortDay(o.start)}</span> {o.title}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>
          Lernzeit pro Fach findest du unter <Link href="/fokus">Fokus</Link>.
        </p>
      </section>
    </>
  );
}

function ExamCard({ plan: x }: { plan: ExamPlan }) {
  const urgent = x.daysLeft <= 7;
  return (
    <article className={`sheet panel lp-exam ${urgent ? "is-urgent" : ""}`}>
      <div className="row spread">
        <div>
          <h3 className="lp-exam-title">{x.course}</h3>
          <p className="small muted" style={{ margin: 0 }}>
            {fmtShortDay(x.exam.start)}
            {!x.exam.allDay && `, ${fmtTime(x.exam.start)}`}
            {x.exam.location && ` · ${x.exam.location}`}
          </p>
        </div>
        <div className="lp-days">
          {x.daysLeft}
          <small>{x.daysLeft === 1 ? "Tag" : "Tage"}</small>
        </div>
      </div>
      <p className="pill">{PHASE_LABEL[x.phase]}</p>
      <div className="lp-meter" title="Grobe Einschätzung aus Nachbereitung und sicheren Karten">
        <div className="bar">
          <span style={{ width: `${x.readiness}%` }} />
        </div>
        <span className="small">{x.readiness} % bereit</span>
      </div>
      <dl className="lp-facts small">
        <div>
          <dt>Nachbereitet</dt>
          <dd>
            {x.prepared} von {x.held} Lektionen{x.remaining ? `, ${x.remaining} kommen noch` : ""}
          </dd>
        </div>
        <div>
          <dt>Karten</dt>
          <dd>
            {x.cards.total ? `${x.cards.mastered} von ${x.cards.total} sicher, ${x.cards.fresh} noch neu` : "noch keine Karten"}
          </dd>
        </div>
      </dl>
      {x.todo.length > 0 && (
        <>
          <h4 className="panel-sub" style={{ marginTop: 10 }}>
            Heute
          </h4>
          <ul className="lp-todo small">
            {x.todo.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function PendingRow({ o, now }: { o: Occurrence; now: number }) {
  const mark = () => putItems("marks", [{ id: `nachbereitet:${o.key}`, createdAt: Date.now() }]);
  return (
    <li>
      <div>
        <strong>{o.course}</strong>
        <div className="small muted">
          {fmtShortDay(o.start)}, {fmtTime(o.start)} · {relDay(o.start, now)}
        </div>
      </div>
      <div className="row">
        <Link className="btn btn-primary small" href="/vorlesungen">
          Folien hinzufügen
        </Link>
        <button className="btn btn-quiet small" onClick={mark} title="Ohne Nachbereitung in Jarvis als erledigt markieren">
          Erledigt
        </button>
      </div>
    </li>
  );
}
