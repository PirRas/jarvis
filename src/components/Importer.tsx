"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { describeFilter, filterSuggestedVideos } from "@/components/Videos";
import { groupByCourse, matchExistingCourse } from "@/lib/courses";
import { listLectures, saveLecture } from "@/lib/db";
import { notesPrompt, STUDY_PROMPT, videosPrompt } from "@/lib/prompts";
import { NotesSchema, parseClaudeJson, StudySchema, VideosSchema } from "@/lib/schema";

// Entwurf merken: Auf dem Handy lädt der Browser die Seite oft neu, wenn man zur Claude-App wechselt.
const DRAFT_KEY = "import-draft";

type Draft = { notes: string; study: string; videos: string };
const EMPTY: Draft = { notes: "", study: "", videos: "" };

function loadDraft(): Draft {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") };
  } catch {
    return EMPTY;
  }
}

export function Importer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notesRaw, setNotesRaw] = useState("");
  const [studyRaw, setStudyRaw] = useState("");
  const [videosRaw, setVideosRaw] = useState("");
  const [courses, setCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    setNotesRaw(d.notes);
    setStudyRaw(d.study);
    setVideosRaw(d.videos);
    if (d.notes || d.study) setOpen(true);
  }, []);

  // Vorhandene Fächer, damit Claude und die App neue Vorlesungen dem richtigen Fach zuordnen.
  useEffect(() => {
    if (open) listLectures().then((l) => setCourses(groupByCourse(l).map((g) => g.name)));
  }, [open]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ notes: notesRaw, study: studyRaw, videos: videosRaw }));
    } catch {
      // Speicher nicht verfügbar: Entwurf gilt nur für diese Sitzung.
    }
  }, [notesRaw, studyRaw, videosRaw]);

  const notes = useMemo(() => (notesRaw.trim() ? parseClaudeJson(notesRaw, NotesSchema) : null), [notesRaw]);
  const study = useMemo(() => (studyRaw.trim() ? parseClaudeJson(studyRaw, StudySchema) : null), [studyRaw]);
  const videos = useMemo(() => (videosRaw.trim() ? parseClaudeJson(videosRaw, VideosSchema) : null), [videosRaw]);
  const videoFilter = videos?.ok ? filterSuggestedVideos(videos.data.videos) : null;
  const course = notes?.ok ? matchExistingCourse(notes.data.course, courses) : null;

  async function save() {
    if (!notes?.ok || !study?.ok) return;
    setSaving(true);
    const id = crypto.randomUUID();
    await saveLecture({
      id,
      fileName: notes.data.title,
      createdAt: Date.now(),
      title: notes.data.title,
      course: course ?? notes.data.course,
      notes: { ...notes.data, course: course ?? notes.data.course },
      study: study.data,
      videos: videoFilter?.kept ?? [],
    });
    setNotesRaw("");
    setStudyRaw("");
    setVideosRaw("");
    router.push(`/vorlesung?id=${id}`);
  }

  if (!open) {
    return (
      <div className="drop" onClick={() => setOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(true)}>
        <span className="drop-title">Neue Vorlesung hinzufügen</span>
        <span className="muted">
          Die Folien bereitest du kostenlos mit deinem Claude-Konto auf claude.ai auf. Die App führt dich Schritt
          für Schritt durch.
        </span>
        <span className="btn btn-primary" style={{ marginTop: 10 }}>
          Los geht’s
        </span>
      </div>
    );
  }

  return (
    <section className="sheet importer">
      <div className="row spread">
        <h2 style={{ fontSize: "var(--step-2)" }}>Neue Vorlesung hinzufügen</h2>
        <button className="btn btn-quiet" onClick={() => setOpen(false)}>
          Schließen
        </button>
      </div>

      <ol className="steps">
        <li>
          <h3>Folien an Claude geben</h3>
          <p className="muted">
            Öffne claude.ai oder die Claude-App, starte einen <strong>neuen Chat</strong> und hänge die Folien als PDF an.
            PowerPoint vorher als PDF speichern, damit Bilder und Diagramme mitgelesen werden.
          </p>
          <a className="btn" href="https://claude.ai/new" target="_blank" rel="noreferrer">
            claude.ai öffnen
          </a>
        </li>

        <li>
          <h3>Nachbereitung erzeugen</h3>
          <p className="muted">
            Kopiere den ersten Prompt, füge ihn im Chat zur PDF ein und sende ihn. Kopiere dann Claudes komplette Antwort
            (den JSON-Codeblock) und füge sie hier ein.
          </p>
          <CopyButton text={notesPrompt(courses)} label="Prompt 1 kopieren" />
          <textarea
            className="answer-box"
            placeholder="Claudes Antwort auf Prompt 1 hier einfügen"
            value={notesRaw}
            onChange={(e) => setNotesRaw(e.target.value)}
            spellCheck={false}
          />
          {notes && (
            <p className={notes.ok ? "verdict-ok small" : "error small"} role="status">
              {notes.ok
                ? `Erkannt: „${notes.data.title}“ mit ${notes.data.slides.length} Folien, ${notes.data.sections.length} Abschnitten und ${notes.data.glossary.length} Begriffen.`
                : notes.error}
            </p>
          )}
          {notes?.ok && course !== notes.data.course && (
            <p className="muted small" style={{ margin: 0 }}>
              Wird zum bestehenden Fach „{course}“ hinzugefügt.
            </p>
          )}
        </li>

        <li>
          <h3>Karteikarten und Quiz erzeugen</h3>
          <p className="muted">
            Kopiere den zweiten Prompt und sende ihn <strong>im selben Chat</strong>. Füge die Antwort hier ein.
          </p>
          <CopyButton text={STUDY_PROMPT} label="Prompt 2 kopieren" />
          <textarea
            className="answer-box"
            placeholder="Claudes Antwort auf Prompt 2 hier einfügen"
            value={studyRaw}
            onChange={(e) => setStudyRaw(e.target.value)}
            spellCheck={false}
          />
          {study && (
            <p className={study.ok ? "verdict-ok small" : "error small"} role="status">
              {study.ok
                ? `Erkannt: ${study.data.flashcards.length} Karteikarten, ${study.data.quiz.length} Quizfragen und ${study.data.exam_tasks.length} Klausuraufgaben.`
                : study.error}
            </p>
          )}
        </li>

        <li>
          <h3>Erklärvideos finden (optional)</h3>
          <p className="muted">
            Sende den dritten Prompt im selben Chat. Claude sucht dann im Web 2 bis 3 passende Videos, bei vielen Themen
            mehr. Dafür muss auf claude.ai die Websuche eingeschaltet sein. Du kannst das auch später im Reiter „Videos“
            der Vorlesung nachholen.
          </p>
          {notes?.ok ? (
            <CopyButton text={videosPrompt(notes.data)} label="Prompt 3 kopieren" />
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              Verfügbar, sobald die Antwort auf Prompt 1 eingefügt ist.
            </p>
          )}
          <textarea
            className="answer-box"
            placeholder="Claudes Antwort auf Prompt 3 hier einfügen"
            value={videosRaw}
            onChange={(e) => setVideosRaw(e.target.value)}
            spellCheck={false}
            disabled={!notes?.ok}
          />
          {videos && (
            <p className={videos.ok ? "verdict-ok small" : "error small"} role="status">
              {videos.ok ? describeFilter(videoFilter!) : videos.error}
            </p>
          )}
        </li>
      </ol>

      <div className="row">
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!notes?.ok || !study?.ok || saving || (videos !== null && !videos.ok)}
        >
          Vorlesung speichern
        </button>
        <span className="muted small">
          Antwort abgeschnitten? Schreib im Chat „weiter“ und füge beide Teile hintereinander ein. Bei sehr langen
          Foliensätzen die PDF teilen.
        </span>
      </div>
    </section>
  );
}
