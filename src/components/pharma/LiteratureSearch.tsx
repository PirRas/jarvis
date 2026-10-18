"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { searchPapers, vancouver, type Paper, type PaperFilter } from "@/lib/pharma/literature";

const EXAMPLES = ["paracetamol hepatotoxicity", "metformin mechanism", "CYP3A4 drug interaction", "St John's wort"];

/** Fachliteratur suchen (Europe PMC) und im Vancouver-Stil zitieren. */
export function LiteratureSearch() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PaperFilter>({ reviews: false, openAccess: false, sort: "relevance" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ total: number; papers: Paper[] } | null>(null);

  async function search(query = q) {
    if (!query.trim()) return;
    setQ(query);
    setBusy(true);
    setError(null);
    try {
      setResult(await searchPapers(query, filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Europe PMC ist nicht erreichbar. Bist du online?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ph-stack">
      <form
        className="sheet panel"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <h2 className="panel-title">Fachliteratur</h2>
        <p className="muted small">
          Sucht in Europe PMC (PubMed und frei zugängliche Volltexte). Am besten auf Englisch suchen. Für eine erste
          Übersicht zu einem Thema „nur Reviews“ wählen.
        </p>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field ph-grow">
            <span>Suchbegriffe</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. ibuprofen gastric ulcer" autoComplete="off" />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy || !q.trim()}>
            {busy ? "Suche …" : "Suchen"}
          </button>
        </div>
        <div className="row small" style={{ marginTop: 10 }}>
          <label>
            <input type="checkbox" checked={filter.reviews} onChange={(e) => setFilter({ ...filter, reviews: e.target.checked })} /> nur
            Reviews
          </label>
          <label>
            <input type="checkbox" checked={filter.openAccess} onChange={(e) => setFilter({ ...filter, openAccess: e.target.checked })} />{" "}
            nur frei lesbar
          </label>
          <label>
            Sortieren:{" "}
            <select value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value as PaperFilter["sort"] })}>
              <option value="relevance">Relevanz</option>
              <option value="cited">meist zitiert</option>
              <option value="date">neueste</option>
            </select>
          </label>
        </div>
        <div className="row small" style={{ marginTop: 10 }}>
          <span className="muted">Beispiele:</span>
          {EXAMPLES.map((x) => (
            <button key={x} type="button" className="btn btn-quiet ph-chip" onClick={() => search(x)}>
              {x}
            </button>
          ))}
        </div>
        {error && <p className="error small">{error}</p>}
      </form>

      {result && (
        <section className="sheet panel" aria-live="polite">
          <p className="muted small">
            {result.total.toLocaleString("de-CH")} Treffer{result.total > result.papers.length && `, die ersten ${result.papers.length}`}
          </p>
          {result.papers.length === 0 && <p>Nichts gefunden. Andere oder englische Begriffe versuchen.</p>}
          <ol className="ph-papers">
            {result.papers.map((p) => (
              <li key={p.id}>
                <h3>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.title}
                  </a>
                </h3>
                <p className="small muted">
                  {[p.authors, p.journal, p.year].filter(Boolean).join(" · ")}
                  {p.citedBy > 0 && ` · ${p.citedBy}× zitiert`}
                  {p.openAccess && " · frei lesbar"}
                  {/review/i.test(p.type) && " · Review"}
                </p>
                <div className="row">
                  <CopyButton text={vancouver(p)} label="Zitat kopieren" />
                  {p.doi && (
                    <a className="btn btn-quiet" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
                      DOI
                    </a>
                  )}
                  {p.pmid && (
                    <a className="btn btn-quiet" href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`} target="_blank" rel="noreferrer">
                      PubMed
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
