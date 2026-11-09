"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Counts } from "@/components/Counts";
import { Md } from "@/components/Md";
import { Quiz } from "@/components/Quiz";
import { ShareDeck } from "@/components/ShareDeck";
import { useRemoteRefresh } from "@/components/SyncBadge";
import { Videos } from "@/components/Videos";
import {
  cardsForLecture,
  deleteLecture,
  getLecture,
  getSettings,
  newCardsLeftToday,
  setLectureVideos,
  updateLectureMeta,
  type Lecture,
} from "@/lib/db";
import { countDue, isMastered, type CardState } from "@/lib/srs";

type Tab = "notes" | "slides" | "glossary" | "cards" | "quiz" | "exam" | "videos";

export default function LecturePage() {
  return (
    <Suspense fallback={<p className="muted">Lade …</p>}>
      <LectureInner />
    </Suspense>
  );
}

function LectureInner() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [lecture, setLecture] = useState<Lecture | null | undefined>();
  const [cards, setCards] = useState<CardState[]>([]);
  const [newLeft, setNewLeft] = useState(0);
  const [tab, setTab] = useState<Tab>("notes");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const [l, c, n] = await Promise.all([getLecture(id), cardsForLecture(id), newCardsLeftToday(getSettings().newPerDay)]);
    setLecture(l ?? null);
    setCards(c);
    setNewLeft(n);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useRemoteRefresh(load);

  // Formular steht oben, der Knopf unten: hinspringen und Titel fokussieren.
  useEffect(() => {
    if (!editing) return;
    const form = document.getElementById("lecture-edit");
    form?.scrollIntoView({ block: "start" });
    form?.querySelector("input")?.focus({ preventScroll: true });
  }, [editing]);

  if (lecture === undefined) return <p className="muted">Lade …</p>;
  if (lecture === null)
    return (
      <div className="sheet empty">
        <h2>Diese Vorlesung gibt es nicht mehr</h2>
        <Link className="btn" href="/vorlesungen">
          Zu den Vorlesungen
        </Link>
      </div>
    );

  const { notes, study } = lecture;
  const counts = countDue(cards, newLeft);
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "notes", label: "Nachbereitung" },
    { key: "slides", label: "Folien", count: notes.slides.length },
    { key: "glossary", label: "Begriffe und Formeln", count: notes.glossary.length + notes.formulas.length },
    { key: "cards", label: "Karteikarten", count: cards.length },
    { key: "quiz", label: "Quiz", count: study.quiz.length },
    { key: "exam", label: "Klausuraufgaben", count: study.exam_tasks.length },
    { key: "videos", label: "Videos", count: lecture.videos?.length ?? 0 },
  ];

  async function remove() {
    if (!confirm(`„${lecture!.title}“ mit allen Karten und Lernfortschritt löschen?`)) return;
    await deleteLecture(id);
    router.push("/heute");
  }

  return (
    <>
      <Link href="/vorlesungen" className="crumb">
        Vorlesungen / {lecture.course}
      </Link>

      {editing ? (
        <form
          id="lecture-edit"
          className="sheet"
          style={{ padding: 20, display: "grid", gap: 12, maxWidth: 640, scrollMarginTop: 80 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const title = String(f.get("title")).trim() || lecture.title;
            const course = String(f.get("course")).trim() || lecture.course;
            await updateLectureMeta(id, title, course);
            setLecture({ ...lecture, title, course });
            setEditing(false);
          }}
        >
          <label className="field">
            Titel
            <input name="title" defaultValue={lecture.title} />
          </label>
          <label className="field">
            Fach
            <input name="course" defaultValue={lecture.course} />
          </label>
          <div className="row">
            <button className="btn btn-primary">Speichern</button>
            <button type="button" className="btn btn-quiet" onClick={() => setEditing(false)}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <div className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <h1 className="page-title">{lecture.title}</h1>
            <p className="lede small">
              {lecture.fileName}, hochgeladen am{" "}
              {new Date(lecture.createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="row">
            <Counts counts={counts} />
            <Link className="btn btn-primary" href={`/lernen?deck=${id}`}>
              Karten lernen
            </Link>
            <ShareDeck lecture={lecture} />
          </div>
        </div>
      )}

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" className="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            {t.count !== undefined && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "notes" && (
        <div className="read-layout">
          <nav className="toc" aria-label="Gliederung">
            <ol>
              {notes.sections.map((s, i) => (
                <li key={i}>
                  <a href={`#s${i}`}>
                    <span className="n">{i + 1}</span>
                    <span>{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="reading">
            <Md>{notes.overview}</Md>
            {notes.learning_goals.length > 0 && (
              <div className="sheet goals">
                <h3>Nach dieser Vorlesung solltest du …</h3>
                <ul>
                  {notes.learning_goals.map((g) => (
                    <li key={g}>
                      <Md>{g}</Md>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {notes.sections.map((s, i) => (
              <section className="section" id={`s${i}`} key={i}>
                <h2>{s.title}</h2>
                <span className="slide-ref">{s.slides}</span>
                <Md>{s.content}</Md>
                {s.key_points.length > 0 && (
                  <div className="keypoints">
                    <h4>Das Wichtigste</h4>
                    <ul>
                      {s.key_points.map((k) => (
                        <li key={k}>
                          <Md>{k}</Md>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.exam_hint && (
                  <div className="exam-hint">
                    <strong>Prüfungstipp: </strong>
                    {s.exam_hint}
                  </div>
                )}
              </section>
            ))}
            {notes.connections && (
              <section className="section">
                <h2>Zusammenhänge</h2>
                <Md>{notes.connections}</Md>
              </section>
            )}
            <div className="row" style={{ marginTop: 24 }}>
              <button className="btn btn-quiet" onClick={() => setEditing(true)}>
                Titel und Fach ändern
              </button>
              <button className="btn btn-danger" onClick={remove}>
                Vorlesung löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "slides" && (
        <div className="reading" style={{ maxWidth: 820 }}>
          <p className="muted" style={{ fontFamily: "var(--font-ui)" }}>
            Jede Folie mit ihrem Kerninhalt. So siehst du, dass in der Nachbereitung nichts fehlt.
          </p>
          <ol className="slides sheet">
            {notes.slides.map((s) => (
              <li key={s.number}>
                <span className="n">{s.number}</span>
                <div>
                  <strong style={{ background: "none" }}>{s.title}</strong>
                  <div className="muted">{s.gist}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === "glossary" && <Glossary lecture={lecture} />}

      {tab === "cards" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="sheet" style={{ padding: 22 }}>
            <div className="row spread">
              <div>
                <h2 style={{ fontSize: "var(--step-2)" }}>{cards.length} Karteikarten</h2>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  {cards.filter((c) => c.queue === "new").length} neu, {cards.filter(isMastered).length} sicher gelernt,{" "}
                  {cards.filter((c) => c.suspended).length} zurückgestellt
                </p>
              </div>
              <div className="row">
                <Link className="btn" href={`/karten?deck=${id}`}>
                  Karten durchsuchen und bearbeiten
                </Link>
                <Link className="btn btn-primary" href={`/lernen?deck=${id}`}>
                  Jetzt lernen
                </Link>
              </div>
            </div>
          </div>
          <div className="sheet table-wrap">
            <table className="browser-table">
              <thead>
                <tr>
                  <th>Vorderseite</th>
                  <th>Rückseite</th>
                  <th>Thema</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id} className={c.suspended ? "is-suspended" : ""} onClick={() => router.push(`/karten?id=${encodeURIComponent(c.id)}`)}>
                    <td>
                      <Md>{c.front}</Md>
                    </td>
                    <td>
                      <Md>{c.back}</Md>
                    </td>
                    <td className="muted">{c.topic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "quiz" && <Quiz lectureId={id} questions={study.quiz} />}

      {tab === "videos" && (
        <Videos
          notes={notes}
          videos={lecture.videos ?? []}
          onChange={async (videos) => {
            await setLectureVideos(id, videos);
            setLecture({ ...lecture, videos });
          }}
        />
      )}

      {tab === "exam" && (
        <div className="reading" style={{ maxWidth: 820 }}>
          <p className="muted" style={{ fontFamily: "var(--font-ui)" }}>
            Bearbeite die Aufgaben erst auf Papier und vergleiche dann mit der Musterlösung.
          </p>
          {study.exam_tasks.map((t, i) => (
            <article className="sheet task" key={i}>
              <div className="task-head" style={{ fontFamily: "var(--font-ui)" }}>
                <span>Aufgabe {i + 1}</span>
                <span className="muted">
                  {t.topic}, {t.points} Punkte
                </span>
              </div>
              <Md>{t.task}</Md>
              <details className="solution">
                <summary style={{ fontFamily: "var(--font-ui)" }}>Musterlösung anzeigen</summary>
                <Md>{t.model_answer}</Md>
              </details>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Glossary({ lecture }: { lecture: Lecture }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const terms = lecture.notes.glossary
    .filter((g) => !needle || `${g.term} ${g.definition}`.toLowerCase().includes(needle))
    .sort((a, b) => a.term.localeCompare(b.term, "de"));

  return (
    <div style={{ display: "grid", gap: 32 }}>
      <input className="search" placeholder="Begriff suchen" value={q} onChange={(e) => setQ(e.target.value)} />
      <dl className="glossary sheet">
        {terms.map((g) => (
          <div key={g.term}>
            <dt>
              <span>{g.term}</span>
            </dt>
            <dd>
              <Md>{g.definition}</Md>
            </dd>
          </div>
        ))}
        {terms.length === 0 && <p className="muted" style={{ padding: 18 }}>Kein Begriff passt zu „{q}“.</p>}
      </dl>
      {lecture.notes.formulas.length > 0 && (
        <section>
          <h2 style={{ fontSize: "var(--step-2)", marginBottom: 12 }}>Formeln</h2>
          <div className="sheet reading" style={{ maxWidth: "none", padding: "8px 22px" }}>
            {lecture.notes.formulas.map((f) => (
              <div key={f.name} style={{ padding: "14px 0", borderBottom: "1px solid var(--rule)" }}>
                <strong style={{ background: "none", fontFamily: "var(--font-ui)" }}>{f.name}</strong>
                <Md>{`$$${f.latex}$$`}</Md>
                <div className="muted">
                  <Md>{f.explanation}</Md>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
