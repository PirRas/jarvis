"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { groupByCourse, matchExistingCourse } from "@/lib/courses";
import { listLectures, saveLecture } from "@/lib/db";
import { decodeDeck, parseDeckFile, type DecodeResult, type SharedDeck } from "@/lib/share";
import "./teilen.css";

/** Geteilten Stapel (Link mit #d=… oder .jarvis.json-Datei) ansehen und übernehmen. */
export default function SharePage() {
  const router = useRouter();
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listLectures().then((l) => setCourses(groupByCourse(l).map((g) => g.name)));
    const read = () => {
      const m = /[#&]d=([^&]*)/.exec(window.location.hash);
      if (!m) {
        setLoading(false);
        return;
      }
      setLoading(true);
      decodeDeck(m[1]).then((r) => {
        setResult(r);
        setLoading(false);
      });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  async function openFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      setResult({ ok: false, error: "Die Datei ist zu gross." });
      return;
    }
    setResult(parseDeckFile(await f.text()));
  }

  async function take(deck: SharedDeck) {
    setSaving(true);
    const id = crypto.randomUUID();
    const course = matchExistingCourse(deck.course, courses);
    await saveLecture({
      id,
      fileName: `Geteilt: ${deck.title}`,
      createdAt: Date.now(),
      title: deck.title,
      course,
      notes: { ...deck.notes, course },
      study: deck.study,
      videos: deck.videos ?? [],
    });
    router.push(`/vorlesung?id=${id}`);
  }

  const deck = result?.ok ? result.deck : null;
  const course = deck ? matchExistingCourse(deck.course, courses) : "";

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Geteilter Stapel</h1>
          <p className="lede">
            Kommiliton:innen können dir ihre Nachbereitung samt Karteikarten und Quiz schicken. Hier siehst du, was drin ist,
            und übernimmst es in deine Vorlesungen.
          </p>
        </div>
      </div>

      {loading && <p className="muted">Entpacke …</p>}

      {!loading && result && !result.ok && <p className="error">{result.error}</p>}

      {deck && (
        <section className="sheet panel sh-preview">
          <p className="sh-course">
            {course}
          </p>
          <h2 className="sh-title">{deck.title}</h2>
          <ul className="sh-counts">
            <li>
              <strong>{deck.notes.slides.length}</strong> Folien
            </li>
            <li>
              <strong>{deck.notes.sections.length}</strong> Abschnitte
            </li>
            <li>
              <strong>{deck.study.flashcards.length}</strong> Karteikarten
            </li>
            <li>
              <strong>{deck.study.quiz.length}</strong> Quizfragen
            </li>
            <li>
              <strong>{deck.study.exam_tasks.length}</strong> Klausuraufgaben
            </li>
            {!!deck.videos?.length && (
              <li>
                <strong>{deck.videos.length}</strong> Videos
              </li>
            )}
          </ul>
          {deck.notes.overview && <p className="muted sh-overview">{deck.notes.overview.slice(0, 400)}{deck.notes.overview.length > 400 ? " …" : ""}</p>}
          {course !== deck.course && (
            <p className="small muted" style={{ margin: 0 }}>
              Wird zum bestehenden Fach „{course}“ hinzugefügt.
            </p>
          )}
          <div className="row">
            <button className="btn btn-primary" onClick={() => take(deck)} disabled={saving}>
              {saving ? "Übernehme …" : "In meine Vorlesungen übernehmen"}
            </button>
            <Link className="btn btn-quiet" href="/vorlesungen">
              Abbrechen
            </Link>
          </div>
        </section>
      )}

      {!loading && (
        <section className="sheet panel sh-file">
          <h2 className="panel-title">Stapel-Datei öffnen</h2>
          <p className="small muted">Ist der Stapel zu gross für einen Link, kommt er als Datei mit der Endung .jarvis.json.</p>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              openFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button className="btn" onClick={() => file.current?.click()}>
            Datei auswählen
          </button>
        </section>
      )}
    </>
  );
}
