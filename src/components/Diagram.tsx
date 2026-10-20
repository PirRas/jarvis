"use client";

import { useEffect, useId, useState } from "react";

let initialized = false;

/** Mermaid-Diagramm im Jarvis-Look; mermaid wird erst beim ersten Diagramm geladen. */
export function Diagram({ code }: { code: string }) {
  const id = "mmd" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [state, setState] = useState<{ svg: string } | "error" | null>(null);

  useEffect(() => {
    let alive = true;
    setState(null);
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        if (!initialized) {
          initialized = true;
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            fontFamily: "var(--font-ui), system-ui, sans-serif",
            // Natürliche Grösse statt auf Handybreite schrumpfen (Schrift sonst unlesbar); der Rahmen scrollt
            flowchart: { useMaxWidth: false },
            sequence: { useMaxWidth: false },
            state: { useMaxWidth: false },
            mindmap: { useMaxWidth: false },
            themeVariables: {
              darkMode: true,
              background: "#050f1b",
              primaryColor: "#0f2639",
              primaryBorderColor: "#46d5f5",
              primaryTextColor: "#dcf3ff",
              secondaryColor: "#0b1d2e",
              tertiaryColor: "#0b1d2e",
              lineColor: "#46d5f5",
              textColor: "#dcf3ff",
              mainBkg: "#0f2639",
              nodeBorder: "#46d5f5",
              clusterBkg: "#0b1d2e",
              clusterBorder: "rgba(70, 213, 245, 0.3)",
              edgeLabelBackground: "#0b1d2e",
              titleColor: "#dcf3ff",
            },
          });
        }
        const { svg } = await mermaid.render(id, code);
        if (alive) setState({ svg });
      })
      .catch(() => {
        // mermaid hinterlässt bei Syntaxfehlern ein Fehler-Element im Body
        document.getElementById("d" + id)?.remove();
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, [code, id]);

  if (state === "error")
    return (
      <>
        <pre>
          <code>{code}</code>
        </pre>
        <p className="muted small">Diagramm konnte nicht gezeichnet werden.</p>
      </>
    );
  return (
    <figure className="md-diagram" role="img" aria-label="Diagramm" aria-busy={state === null}>
      {state === null ? (
        <span className="muted small">Diagramm wird geladen …</span>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: state.svg }} />
      )}
    </figure>
  );
}

/** Strukturformel (PubChem); bei Ladefehler erscheint der Alt-Text kursiv. */
export function Structure({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <em className="muted">{alt}</em>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- externes PNG, CSP-freigegeben
    <img className="md-structure" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  );
}

type Wiki = { src: string; page: string; credit: string };
const wikiCache = new Map<string, Promise<Wiki | null>>();

const plain = (html = "") => new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";

function findWiki(term: string) {
  let hit = wikiCache.get(term);
  if (!hit) {
    const q = encodeURIComponent(term + " filetype:bitmap|drawing");
    hit = fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch=${q}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640`,
    )
      .then((r) => r.json())
      .then((j): Wiki | null => {
        type Info = { thumburl: string; descriptionurl: string; extmetadata?: Record<string, { value?: string }> };
        // pages ist nach pageid sortiert, nicht nach Suchrang; Dateien mit Fremdsprach-Suffix nachrangig
        const pages = Object.values<{ index: number; title: string; imageinfo?: Info[] }>(j.query?.pages ?? {}).sort(
          (x, y) => x.index - y.index,
        );
        const foreign = /[ _-](ar|fa|zh|ja|ru|nl|es|fr|it|pt|persian|arabic)(\.[a-z]+)?$/i;
        const info = (pages.find((p) => !foreign.test(p.title.replace(/\.[a-z]+$/i, ""))) ?? pages[0])?.imageinfo?.[0];
        if (!info) return null;
        const m = info.extmetadata ?? {};
        // Artist ist manchmal ein ganzer Absatz mit Nutzungsbitten: kürzen, Details stehen auf der verlinkten Seite
        const artist = plain(m.Artist?.value).split("\n")[0].replace(/[\s/,;:]+$/, "");
        const credit = [artist.length > 60 ? artist.slice(0, 57) + "…" : artist, plain(m.LicenseShortName?.value), "Wikimedia Commons"].filter(Boolean).join(", ");
        return { src: info.thumburl, page: info.descriptionurl, credit };
      })
      .catch(() => {
        wikiCache.delete(term); // Netzfehler nicht dauerhaft merken
        return null;
      });
    wikiCache.set(term, hit);
  }
  return hit;
}

/** Bild aus Wikimedia Commons per Suchbegriff (die KI nennt nur den Begriff, nie eine URL). */
export function WikiImage({ term, alt }: { term: string; alt: string }) {
  const [wiki, setWiki] = useState<Wiki | null | undefined>(undefined);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let alive = true;
    findWiki(term).then((w) => alive && setWiki(w));
    return () => {
      alive = false;
    };
  }, [term]);

  if (wiki === undefined) return <span className="muted small">Bild wird gesucht …</span>;
  if (!wiki || broken) return <em className="muted">{alt}</em>;
  return (
    <span className="md-wiki">
      {/* eslint-disable-next-line @next/next/no-img-element -- externes Bild, CSP-freigegeben */}
      <img src={wiki.src} alt={alt} loading="lazy" onError={() => setBroken(true)} />
      <span className="muted small md-wiki-cap">
        {alt}
        <br />
        <a href={wiki.page} target="_blank" rel="noopener noreferrer">
          Bild: {wiki.credit}
        </a>
      </span>
    </span>
  );
}
