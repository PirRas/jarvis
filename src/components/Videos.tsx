"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { videosPrompt } from "@/lib/prompts";
import { allowedSite } from "@/lib/videoSites";
import { parseClaudeJson, VideosSchema, type Notes, type Video } from "@/lib/schema";

type Parsed =
  | { kind: "youtube"; id: string; start?: number }
  | { kind: "vimeo"; id: string }
  | { kind: "link"; site?: string };

/** Erkennt YouTube- und Vimeo-Links, damit sie eingebettet abgespielt werden können. */
function parseVideoUrl(raw: string): Parsed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  const start = Number(url.searchParams.get("t")?.replace(/s$/, "")) || undefined;
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? { kind: "youtube", id, start } : { kind: "link" };
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] ?? "";
    return /^[\w-]{11}$/.test(id) ? { kind: "youtube", id, start } : { kind: "link" };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{6,})/)?.[1];
    return id ? { kind: "vimeo", id } : { kind: "link" };
  }
  return { kind: "link", site: allowedSite(host)?.name };
}

// Großzügig, damit auch "Deutsch (Schweiz)" oder "English, dt. Untertitel" durchgehen.
const ALLOWED_LANGUAGE = /deutsch|german|englisch|english|^(de|en)$|^$/i;

/**
 * Sortiert Vorschläge von Claude aus, die man nicht direkt ansehen kann: Videos außerhalb von YouTube/Vimeo
 * (oft Bezahl- oder Lizenzplattformen) und Videos in anderen Sprachen als Deutsch oder Englisch.
 */
export function filterSuggestedVideos(videos: Video[]) {
  const kept: Video[] = [];
  let wrongPlatform = 0;
  let wrongLanguage = 0;
  for (const v of videos) {
    const p = parseVideoUrl(v.url);
    const ok = p && (p.kind === "youtube" || p.kind === "vimeo" || (p.kind === "link" && p.site));
    if (!ok) wrongPlatform++;
    else if (!ALLOWED_LANGUAGE.test(v.language.trim())) wrongLanguage++;
    else kept.push(v);
  }
  return { kept, wrongPlatform, wrongLanguage };
}

/** "3 Videos übernommen, 2 aussortiert (nicht auf YouTube)". */
export function describeFilter(f: ReturnType<typeof filterSuggestedVideos>) {
  const reasons = [
    f.wrongPlatform && `${f.wrongPlatform} nicht auf YouTube oder einer freigegebenen Lernplattform`,
    f.wrongLanguage && `${f.wrongLanguage} nicht auf Deutsch oder Englisch`,
  ].filter(Boolean);
  const head = `${f.kept.length} ${f.kept.length === 1 ? "Video" : "Videos"} verwendbar`;
  return reasons.length ? `${head}, aussortiert: ${reasons.join(", ")}.` : `${head}.`;
}

function VideoCard({ video, onRemove }: { video: Video; onRemove: () => void }) {
  const parsed = parseVideoUrl(video.url);
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);

  const embed =
    parsed?.kind === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${parsed.id}?autoplay=1&rel=0${parsed.start ? `&start=${parsed.start}` : ""}`
      : parsed?.kind === "vimeo"
        ? `https://player.vimeo.com/video/${parsed.id}?autoplay=1`
        : null;

  return (
    <article className={`sheet video-card ${missing ? "is-missing" : ""}`}>
      <div className="video-frame">
        {embed && playing ? (
          <iframe
            src={embed}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        ) : parsed?.kind === "youtube" ? (
          <button className="video-poster" onClick={() => setPlaying(true)} aria-label={`${video.title} abspielen`} disabled={missing}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${parsed.id}/mqdefault.jpg`}
              alt=""
              // Für unbekannte Video-IDs liefert YouTube ein 120×90-Platzhalterbild.
              onLoad={(e) => e.currentTarget.naturalWidth <= 120 && setMissing(true)}
              onError={() => setMissing(true)}
            />
            {!missing && <span className="play" aria-hidden />}
          </button>
        ) : embed ? (
          <button className="video-poster is-plain" onClick={() => setPlaying(true)} aria-label={`${video.title} abspielen`}>
            <span className="play" aria-hidden />
          </button>
        ) : (
          <a className="video-poster is-plain" href={video.url} target="_blank" rel="noreferrer">
            {parsed?.kind === "link" && parsed.site ? `Auf ${parsed.site} ansehen` : "Video auf der Website öffnen"}
          </a>
        )}
      </div>
      <div className="video-body">
        <span className="pill">{video.topic}</span>
        <h3>{video.title}</h3>
        <p className="muted small" style={{ margin: 0 }}>
          {video.channel}
          {video.language ? `, ${video.language}` : ""}
        </p>
        {missing ? (
          <p className="error small" style={{ margin: 0 }}>
            Dieses Video gibt es unter dem Link nicht. Vermutlich hat Claude den Link nicht richtig übernommen. Entferne es
            oder lass neue Videos suchen.
          </p>
        ) : (
          video.reason && <p style={{ margin: 0 }}>{video.reason}</p>
        )}
        <div className="row">
          <a className="btn btn-quiet small" href={video.url} target="_blank" rel="noreferrer">
            Auf {parsed?.kind === "youtube" ? "YouTube" : parsed?.kind === "vimeo" ? "Vimeo" : parsed?.kind === "link" && parsed.site ? parsed.site : "der Website"} öffnen
          </a>
          <button className="btn btn-quiet small" onClick={onRemove}>
            Entfernen
          </button>
        </div>
      </div>
    </article>
  );
}

export function Videos({
  notes,
  videos,
  onChange,
}: {
  notes: Notes;
  videos: Video[];
  onChange: (videos: Video[]) => void | Promise<void>;
}) {
  const [searching, setSearching] = useState(videos.length === 0);
  const [raw, setRaw] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const parsed = useMemo(() => (raw.trim() ? parseClaudeJson(raw, VideosSchema) : null), [raw]);
  const filtered = parsed?.ok ? filterSuggestedVideos(parsed.data.videos) : null;
  const prompt = useMemo(() => videosPrompt(notes), [notes]);
  const manualValid = parseVideoUrl(manualUrl) !== null;

  async function addFound(replace: boolean) {
    if (!filtered?.kept.length) return;
    const fresh = filtered.kept;
    const base = replace ? [] : videos;
    const known = new Set(base.map((v) => v.url));
    await onChange([...base, ...fresh.filter((v) => !known.has(v.url))]);
    setRaw("");
    setSearching(false);
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualValid) return;
    await onChange([
      ...videos,
      {
        title: manualTitle.trim() || "Eigenes Video",
        url: manualUrl.trim(),
        channel: "",
        topic: "Eigene Ergänzung",
        reason: "",
        language: "",
      },
    ]);
    setManualUrl("");
    setManualTitle("");
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {videos.length > 0 && (
        <div className="video-grid">
          {videos.map((v, i) => (
            <VideoCard key={v.url + i} video={v} onRemove={() => onChange(videos.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {searching ? (
        <section className="sheet importer">
          <div className="row spread">
            <h2 style={{ fontSize: "var(--step-2)" }}>{videos.length ? "Weitere Videos suchen" : "Erklärvideos finden"}</h2>
            {videos.length > 0 && (
              <button className="btn btn-quiet" onClick={() => setSearching(false)}>
                Schließen
              </button>
            )}
          </div>
          <ol className="steps">
            <li>
              <h3>Prompt an Claude geben</h3>
              <p className="muted">
                Kopiere den Prompt und sende ihn auf claude.ai, im Chat dieser Vorlesung oder in einem neuen. Die Websuche
                muss eingeschaltet sein, damit Claude echte Videos findet.
              </p>
              <div className="row">
                <CopyButton text={prompt} label="Video-Prompt kopieren" />
                <a className="btn" href="https://claude.ai/new" target="_blank" rel="noreferrer">
                  claude.ai öffnen
                </a>
              </div>
            </li>
            <li>
              <h3>Antwort einfügen</h3>
              <textarea
                className="answer-box"
                placeholder="Claudes Antwort hier einfügen"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                spellCheck={false}
              />
              {parsed && (
                <p className={filtered?.kept.length ? "verdict-ok small" : "error small"} role="status">
                  {!parsed.ok
                    ? parsed.error
                    : filtered!.kept.length
                      ? describeFilter(filtered!)
                      : `${describeFilter(filtered!)} Bitte Claude: „Bitte nur frei abspielbare YouTube-Videos auf Deutsch oder Englisch.“`}
                </p>
              )}
              <div className="row">
                <button className="btn btn-primary" onClick={() => addFound(false)} disabled={!filtered?.kept.length}>
                  Videos übernehmen
                </button>
                {videos.length > 0 && (
                  <button className="btn" onClick={() => addFound(true)} disabled={!filtered?.kept.length}>
                    Bisherige ersetzen
                  </button>
                )}
              </div>
            </li>
          </ol>
        </section>
      ) : (
        <div className="row">
          <button className="btn" onClick={() => setSearching(true)}>
            Weitere Videos suchen
          </button>
        </div>
      )}

      <form className="sheet stat-panel" style={{ display: "grid", gap: 12, maxWidth: 640 }} onSubmit={addManual}>
        <h2>Eigenes Video hinzufügen</h2>
        <label className="field">
          Link (YouTube, Vimeo oder andere Seite)
          <input type="url" value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
        </label>
        <label className="field">
          Titel (optional)
          <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} />
        </label>
        <div>
          <button className="btn" disabled={!manualValid}>
            Video hinzufügen
          </button>
        </div>
      </form>
    </div>
  );
}
