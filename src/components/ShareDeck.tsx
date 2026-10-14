"use client";

import { useState } from "react";
import "@/app/teilen/teilen.css";
import type { Lecture } from "@/lib/db";
import { deckFileName, deckFromLecture, encodeDeck, SHARE_LINK_LIMIT, shareUrl } from "@/lib/share";

/** Stapel einer Vorlesung (ohne Lernfortschritt) per Link oder Datei weitergeben. */
export function ShareDeck({ lecture }: { lecture: Lecture }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const deck = deckFromLecture(lecture);

  async function shareLink() {
    setBusy(true);
    setStatus(null);
    try {
      const url = shareUrl(window.location.origin, await encodeDeck(deck));
      if (url.length > SHARE_LINK_LIMIT) {
        setStatus({ ok: false, text: "Dieser Stapel ist zu gross für einen Link. Speichere ihn als Datei und schicke die Datei." });
        return;
      }
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try {
          await navigator.share({ title: `Jarvis-Stapel: ${lecture.title}`, url });
          setStatus({ ok: true, text: "Geteilt." });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // abgebrochen
        }
      }
      await navigator.clipboard.writeText(url);
      setStatus({ ok: true, text: "Link kopiert. Wer ihn öffnet, kann den Stapel in Jarvis übernehmen." });
    } catch {
      setStatus({ ok: false, text: "Der Link konnte nicht erstellt werden. Speichere den Stapel als Datei." });
    } finally {
      setBusy(false);
    }
  }

  function saveFile() {
    const blob = new Blob([JSON.stringify(deck)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = deckFileName(lecture.title);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus({ ok: true, text: "Datei gespeichert. Öffnen lässt sie sich in Jarvis unter /teilen." });
  }

  return (
    <div className="sh-wrap">
      <button className="btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Teilen
      </button>
      {open && (
        <div className="sheet sh-panel">
          <p className="small muted" style={{ marginTop: 0 }}>
            Gibt Nachbereitung, {lecture.study.flashcards.length} Karten, {lecture.study.quiz.length} Quizfragen und die
            Klausuraufgaben weiter. Dein Lernfortschritt bleibt bei dir.
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={shareLink} disabled={busy}>
              {busy ? "Packe …" : "Link teilen"}
            </button>
            <button className="btn" onClick={saveFile}>
              Als Datei speichern
            </button>
          </div>
          {status && (
            <p className={status.ok ? "verdict-ok small" : "error small"} role="status" style={{ marginBottom: 0 }}>
              {status.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
