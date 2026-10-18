"use client";

import { useState } from "react";
import { infoLinks, lipinski, lookupCompound, veber, type Compound } from "@/lib/pharma/pubchem";

const EXAMPLES = ["Paracetamol", "Ibuprofen", "Acetylsalicylsäure", "Coffein", "Metformin"];

/** Wirkstoff-Steckbrief aus PubChem: Struktur, Summenformel, Molmasse, Lipinski. */
export function CompoundLookup() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; compound: Compound } | null>(null);

  async function search(q = name) {
    if (!q.trim()) return;
    setName(q);
    setBusy(true);
    setError(null);
    try {
      const c = await lookupCompound(q);
      if (!c) {
        setResult(null);
        setError(`„${q}“ kennt PubChem nicht. Versuche den englischen Namen oder den internationalen Freinamen (INN), z. B. „acetaminophen“ oder „aspirin“.`);
      } else setResult({ name: q, compound: c });
    } catch (e) {
      setError(e instanceof Error ? e.message : "PubChem ist nicht erreichbar. Bist du online?");
    } finally {
      setBusy(false);
    }
  }

  const c = result?.compound;
  const lip = c ? lipinski(c) : null;
  const veb = c ? veber(c) : null;

  return (
    <div className="ph-stack">
      <form
        className="sheet panel"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <h2 className="panel-title">Wirkstoff-Steckbrief</h2>
        <p className="muted small">
          Daten aus PubChem (US National Library of Medicine). Deutsche Namen funktionieren oft, sonst den englischen Namen
          oder den INN eingeben.
        </p>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field ph-grow">
            <span>Wirkstoff</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Ibuprofen" autoComplete="off" />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Suche …" : "Nachschlagen"}
          </button>
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

      {c && lip && result && (
        <article className="sheet panel ph-compound">
          <div className="ph-structure">
            {/* Strukturbild direkt von PubChem */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image} alt={`Strukturformel von ${result.name}`} width={300} height={300} loading="lazy" />
          </div>
          <div className="ph-facts">
            <h2 className="panel-title">{result.name}</h2>
            {c.query.toLowerCase() !== result.name.trim().toLowerCase() && (
              <p className="muted small">gefunden als „{c.query}“</p>
            )}
            <dl className="ph-dl">
              <dt>Summenformel</dt>
              <dd className="ph-formula">{c.formula}</dd>
              <dt>Molmasse</dt>
              <dd>{c.mw.toFixed(2)} g/mol</dd>
              <dt>IUPAC-Name</dt>
              <dd className="ph-break">{c.iupac || "–"}</dd>
              <dt>SMILES</dt>
              <dd className="ph-break ph-mono">{c.smiles || "–"}</dd>
              <dt>logP (XLogP)</dt>
              <dd>{c.xlogp ?? "–"}</dd>
              <dt>Polare Oberfläche (TPSA)</dt>
              <dd>{c.tpsa === null ? "–" : `${c.tpsa} Å²`}</dd>
            </dl>

            <h3 className="ph-sub">Lipinskis Rule of Five</h3>
            <ul className="ph-rules">
              {lip.rules.map((r) => (
                <li key={r.label} className={r.ok ? "is-ok" : "is-bad"}>
                  <span>{r.ok ? "ja" : "nein"}</span> · {r.label}: <strong>{r.value}</strong>
                </li>
              ))}
            </ul>
            <p className="small muted">
              {lip.passes
                ? `${lip.violations === 0 ? "Kein Verstoss" : "Ein Verstoss"}: Eine orale Bioverfügbarkeit ist nach dieser Faustregel plausibel.`
                : `${lip.violations} Verstösse: Nach der Faustregel ist eine orale Aufnahme erschwert (Ausnahmen z. B. Ciclosporin oder Substrate von Transportern).`}
            </p>

            {veb && (
              <>
                <h3 className="ph-sub">Veber-Regeln</h3>
                <ul className="ph-rules">
                  {veb.rules.map((r) => (
                    <li key={r.label} className={r.ok ? "is-ok" : "is-bad"}>
                      <span>{r.ok ? "ja" : "nein"}</span> · {r.label}: <strong>{r.value}</strong>
                    </li>
                  ))}
                </ul>
                <p className="small muted">
                  {veb.passes ? "Erfüllt: gute orale Bioverfügbarkeit wahrscheinlich." : "Nicht erfüllt: eher zu flexibel oder zu polar für eine gute Resorption."}
                  {veb.cns === true && " TPSA bis 90 Å²: kann die Blut-Hirn-Schranke eher passieren."}
                  {veb.cns === false && " TPSA über 90 Å²: gelangt eher schlecht ins ZNS."}
                </p>
              </>
            )}

            {c.synonyms.length > 0 && (
              <>
                <h3 className="ph-sub">Weitere Namen</h3>
                <p className="small">{c.synonyms.join(" · ")}</p>
              </>
            )}

            <div className="row">
              <a className="btn" href={c.url} target="_blank" rel="noreferrer">
                PubChem
              </a>
              {infoLinks(result.name).map((l) => (
                <a key={l.label} className="btn btn-quiet" href={l.url} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
