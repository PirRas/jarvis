"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getLecture, saveLecture } from "@/lib/db";
import { PLANT_COURSE, PLANT_DECK_ID, plantDeck } from "@/lib/pharma/plantDeck";
import { PLANT_FAMILIES, PLANTS } from "@/lib/pharma/plants";

/** Arznei- und Giftpflanzen mit Bild, Filter und Karteikarten-Stapel. */
export function PlantGallery() {
  const [family, setFamily] = useState("");
  const [toxic, setToxic] = useState<"" | "yes" | "no">("");
  const [query, setQuery] = useState("");
  const [deck, setDeck] = useState<"unknown" | "missing" | "exists" | "saving">("unknown");

  useEffect(() => {
    getLecture(PLANT_DECK_ID).then((l) => setDeck(l ? "exists" : "missing"));
  }, []);

  async function addDeck() {
    setDeck("saving");
    // Nur anlegen, wenn es den Stapel noch nicht gibt: erneutes Speichern würde den Lernfortschritt zurücksetzen.
    if (await getLecture(PLANT_DECK_ID)) return setDeck("exists");
    const { notes, study } = plantDeck();
    await saveLecture({
      id: PLANT_DECK_ID,
      fileName: "Arzneipflanzen (Jarvis)",
      createdAt: Date.now(),
      title: notes.title,
      course: PLANT_COURSE,
      notes,
      study,
    });
    setDeck("exists");
  }

  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      PLANTS.filter(
        (p) =>
          (!family || p.family === family) &&
          (!toxic || (toxic === "yes") === p.toxic) &&
          (!q || `${p.latin} ${p.german} ${p.constituents}`.toLowerCase().includes(q)),
      ),
    [family, toxic, q],
  );

  return (
    <div className="ph-stack">
      <section className="sheet panel">
        <div className="row spread">
          <div>
            <h2 className="panel-title">Arznei- und Giftpflanzen</h2>
            <p className="muted small" style={{ margin: 0 }}>
              {PLANTS.length} Pflanzen passend zur Vorlesung „{PLANT_COURSE}“.
            </p>
          </div>
          {deck === "exists" ? (
            <Link className="btn" href={`/vorlesung?id=${PLANT_DECK_ID}`}>
              Stapel ist schon in deinen Vorlesungen
            </Link>
          ) : (
            <button className="btn btn-primary" onClick={addDeck} disabled={deck !== "missing"}>
              {deck === "saving" ? "Lege an …" : "Als Karteikarten-Stapel hinzufügen"}
            </button>
          )}
        </div>
        {deck !== "exists" && (
          <p className="muted small">
            {PLANTS.length * 3} Karten: Pflanze am Bild erkennen, Familie und Droge, Inhaltsstoffe und Wirkung. Dazu ein Quiz zu den
            Familien.
          </p>
        )}
        <div className="form-grid ph-filters">
          <label className="field">
            <span>Suche</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name oder Inhaltsstoff, z. B. Alkaloide" />
          </label>
          <label className="field">
            <span>Familie</span>
            <select value={family} onChange={(e) => setFamily(e.target.value)}>
              <option value="">alle</option>
              {PLANT_FAMILIES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Giftig</span>
            <select value={toxic} onChange={(e) => setToxic(e.target.value as typeof toxic)}>
              <option value="">alle</option>
              <option value="yes">nur Giftpflanzen</option>
              <option value="no">nur nicht giftige</option>
            </select>
          </label>
        </div>
      </section>

      {list.length === 0 && <p className="muted">Keine Pflanze passt zu diesem Filter.</p>}

      <ul className="ph-plants">
        {list.map((p) => (
          <li key={p.latin} className="sheet ph-plant">
            {/* Wikimedia-Vorschaubild; Lizenz auf der verlinkten Wikipedia-Seite */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt={`${p.german} (${p.latin})`} loading="lazy" />
            <div className="ph-plant-body">
              <h3>
                <em>{p.latin}</em>
                {p.toxic && (
                  <span className="ph-toxic" title="giftig">
                    giftig
                  </span>
                )}
              </h3>
              <p className="ph-plant-de">{p.german}</p>
              <p className="small">
                <span className="pill">{p.family}</span> · Droge: {p.part}
              </p>
              <p className="small">
                <strong>Inhaltsstoffe:</strong> {p.constituents}
              </p>
              <p className="small muted">{p.use}</p>
              <a className="small ph-source" href={p.source} target="_blank" rel="noreferrer">
                Bild und Lizenz: Wikipedia
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
