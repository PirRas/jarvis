"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { Md } from "@/components/Md";
import { putItem } from "@/lib/db";
import { previewPrompt } from "@/lib/jarvis";
import { readPdf, textForPrompt, topicsFrom } from "@/lib/pdfText";
import { isoDate, previewId, type LessonPreview as Preview, type Occurrence } from "@/lib/planner";

/**
 * Vorschau auf eine Lektion: Folien (PDF) hinzufügen, sofort die Themen sehen
 * und auf Wunsch eine Kurzzusammenfassung von Claude einfügen.
 */
export function LessonPreview({ occ, preview }: { occ: Occurrence; preview: Preview | undefined }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [showSummaryInput, setShowSummaryInput] = useState(false);

  async function addFile(file: File) {
    setBusy(true);
    setError("");
    try {
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error("Bitte die Folien als PDF hinzufügen.");
      const pages = await readPdf(file);
      const topics = topicsFrom(pages);
      if (!pages.some((p) => p.text.trim()))
        throw new Error("In diesem PDF ist kein Text enthalten (eingescannte Folien?). Die Kurzzusammenfassung über Claude funktioniert trotzdem: Hänge das PDF dort direkt an.");
      await putItem("previews", {
        id: previewId(occ.course, occ.start),
        course: occ.course,
        date: isoDate(occ.start),
        fileName: file.name,
        topics,
        text: textForPrompt(pages),
        summary: preview?.summary ?? "",
        createdAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveSummary() {
    if (!preview || !summaryDraft.trim()) return;
    await putItem("previews", { ...preview, summary: summaryDraft.trim().replace(/^```\w*\s*|```\s*$/g, "") });
    setSummaryDraft("");
    setShowSummaryInput(false);
  }

  const picker = (label: string) => (
    <label className={`btn ${preview ? "btn-quiet" : ""}`} aria-busy={busy}>
      {busy ? "Lese Folien …" : label}
      <input
        type="file"
        accept="application/pdf,.pdf"
        hidden
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );

  if (!preview) {
    return (
      <div className="preview preview-empty">
        <p className="muted small" style={{ margin: 0 }}>
          Folien schon auf ADAM? Lade sie hier hoch, dann zeigt dir Jarvis vorab, was in der Lektion drankommt.
        </p>
        {picker("Folien hinzufügen")}
        {error && <p className="error small">{error}</p>}
      </div>
    );
  }

  return (
    <div className="preview">
      <div className="row spread">
        <h3 className="preview-title">Das kommt dran</h3>
        <span className="small muted">{preview.fileName}</span>
      </div>
      {preview.summary ? (
        <div className="preview-summary">
          <Md>{preview.summary}</Md>
        </div>
      ) : (
        preview.topics.length > 0 && (
          <ul className="topic-list">
            {preview.topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )
      )}
      <div className="row">
        {!preview.summary && (
          <>
            <CopyButton text={previewPrompt(occ.course, occ.start, preview.text)} label="Prompt für Kurzzusammenfassung kopieren" />
            <a className="btn btn-quiet" href="https://claude.ai/new" target="_blank" rel="noreferrer">
              claude.ai öffnen
            </a>
            <button className="btn btn-quiet" onClick={() => setShowSummaryInput((v) => !v)}>
              Antwort einfügen
            </button>
          </>
        )}
        {picker("Andere Folien")}
      </div>
      {showSummaryInput && (
        <div className="field" style={{ marginTop: 8 }}>
          <span>Claudes Antwort</span>
          <textarea value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} placeholder="Hier die Vorschau von Claude einfügen" />
          <div className="row">
            <button className="btn btn-primary" onClick={saveSummary} disabled={!summaryDraft.trim()}>
              Speichern
            </button>
          </div>
        </div>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
