"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { describeFilter, filterSuggestedVideos } from "@/components/Videos";
import { groupByCourse, matchExistingCourse } from "@/lib/courses";
import { buildLecture } from "@/lib/lectureRecords";
import { listLectures, saveLecture } from "@/lib/db";
import { generateLecture, getGeminiKey, getOpenRouterKey, getYouTubeKey, setGeminiKey, setOpenRouterKey, setYouTubeKey } from "@/lib/gemini";
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
  const [geminiKey, setKey] = useState("");
  const [editKey, setEditKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [orKey, setOrKey] = useState("");
  const [editOrKey, setEditOrKey] = useState(false);
  const [orKeyInput, setOrKeyInput] = useState("");
  const [ytKey, setYtKey] = useState("");
  const [editYtKey, setEditYtKey] = useState(false);
  const [ytKeyInput, setYtKeyInput] = useState("");
  const [status, setStatus] = useState("");
  const [genError, setGenError] = useState("");
  const [running, setRunning] = useState(false);
  const hasKey = Boolean(geminiKey || orKey);

  useEffect(() => {
    setKey(getGeminiKey());
  }, []);

  useEffect(() => {
    setOrKey(getOpenRouterKey());
  }, []);

  useEffect(() => {
    setYtKey(getYouTubeKey());
  }, []);

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
    const lecture = buildLecture(notes.data, study.data, course ?? notes.data.course, videoFilter?.kept ?? []);
    const id = lecture.id;
    await saveLecture(lecture);
    setNotesRaw("");
    setStudyRaw("");
    setVideosRaw("");
    router.push(`/vorlesung?id=${id}`);
  }

  function saveKey() {
    setGeminiKey(keyInput.trim());
    setKey(keyInput.trim());
    setKeyInput("");
    setEditKey(false);
  }

  function saveOrKey() {
    setOpenRouterKey(orKeyInput.trim());
    setOrKey(orKeyInput.trim());
    setOrKeyInput("");
    setEditOrKey(false);
  }

  function saveYtKey() {
    setYouTubeKey(ytKeyInput.trim());
    setYtKey(ytKeyInput.trim());
    setYtKeyInput("");
    setEditYtKey(false);
  }

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNotesRaw("");
    setStudyRaw("");
    setVideosRaw("");
    setGenError("");
    setRunning(true);
    setStatus("Nachbereitung wird erstellt …");
    const models = new Set<string>();
    let videosDone = false;
    try {
      await generateLecture(
        file,
        {
          notes: notesPrompt(courses),
          study: STUDY_PROMPT,
          parseNotes: (raw) => {
            const parsed = parseClaudeJson(raw, NotesSchema);
            return parsed.ok ? parsed.data : null;
          },
        },
        (step, raw, via) => {
          models.add(via);
          if (step === "notes") {
            setNotesRaw(raw);
            setStatus(`Karteikarten und Quiz werden erstellt … (Nachbereitung von ${via})`);
          } else if (step === "study") {
            setStudyRaw(raw);
            setStatus(`Videos werden gesucht … (Karteikarten von ${via})`);
          } else {
            videosDone = true;
            setVideosRaw(raw);
          }
        },
      );
      setStatus(
        `Fertig mit ${[...models].join(", ")} – prüfe unten und speichere.${videosDone ? "" : " Videos fehlen, im Reiter „Videos“ nachholen."}`,
      );
    } catch (err) {
      setStatus("");
      setGenError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setRunning(false);
    }
  }

  if (!open) {
    return (
      <div className="drop" onClick={() => setOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(true)}>
        <span className="drop-title">Neue Vorlesung hinzufügen</span>
        <span className="muted">
          Folien hochladen – Jarvis erstellt Nachbereitung, Karteikarten und Videos automatisch (kostenlos mit
          Gemini). Alternativ manuell über claude.ai.
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

      <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
        <h3>Automatisch erstellen</h3>
        <p className="muted">
          Jarvis erstellt Nachbereitung, Karteikarten, Quiz und Videos selbst mit dem kostenlosen Gemini-Kontingent von
          Google. Das dauert 1–3 Minuten.
        </p>
        {!geminiKey || editKey ? (
          <div className="row">
            <label className="field">
              Gemini-Schlüssel
              <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoComplete="off" />
            </label>
            <button className="btn" onClick={saveKey} disabled={!keyInput.trim()} aria-label="Gemini-Schlüssel speichern">
              Speichern
            </button>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Schlüssel kostenlos holen
            </a>
          </div>
        ) : (
          <div className="row">
            <span className="muted small">Gemini-Schlüssel gespeichert</span>
            <button className="btn btn-quiet" onClick={() => setEditKey(true)}>
              Ändern
            </button>
          </div>
        )}
        {!orKey || editOrKey ? (
          <div className="row">
            <label className="field">
              OpenRouter-Schlüssel (optional, Ausweiche bei Überlast)
              <input type="password" value={orKeyInput} onChange={(e) => setOrKeyInput(e.target.value)} autoComplete="off" />
            </label>
            <button className="btn" onClick={saveOrKey} disabled={!orKeyInput.trim()} aria-label="OpenRouter-Schlüssel speichern">
              Speichern
            </button>
            <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">
              Schlüssel kostenlos holen
            </a>
          </div>
        ) : (
          <div className="row">
            <span className="muted small">OpenRouter-Schlüssel gespeichert</span>
            <button className="btn btn-quiet" onClick={() => setEditOrKey(true)}>
              Ändern
            </button>
          </div>
        )}
        {!ytKey || editYtKey ? (
          <div className="row">
            <label className="field">
              YouTube-Schlüssel (optional, für Videos)
              <input type="password" value={ytKeyInput} onChange={(e) => setYtKeyInput(e.target.value)} autoComplete="off" />
            </label>
            <button className="btn" onClick={saveYtKey} disabled={!ytKeyInput.trim()} aria-label="YouTube-Schlüssel speichern">
              Speichern
            </button>
            <a href="https://developers.google.com/youtube/v3/getting-started" target="_blank" rel="noreferrer">
              Anleitung
            </a>
          </div>
        ) : (
          <div className="row">
            <span className="muted small">YouTube-Schlüssel gespeichert</span>
            <button className="btn btn-quiet" onClick={() => setEditYtKey(true)}>
              Ändern
            </button>
          </div>
        )}
        <label
          className="btn btn-primary"
          style={!hasKey || running ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
        >
          {running ? "Wird erstellt …" : "PDF wählen und erstellen"}
          <input className="sr-only" type="file" accept="application/pdf" onChange={onPdf} disabled={!hasKey || running} />
        </label>
        {status && (
          <p className="muted small" role="status">
            {status}
          </p>
        )}
        {genError && <p className="error small">{genError}</p>}
      </div>

      <p className="muted">Oder manuell über claude.ai:</p>

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
