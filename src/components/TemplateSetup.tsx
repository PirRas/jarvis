"use client";

import { useState } from "react";
import { putItems } from "@/lib/db";
import { MATH_GROUPS, TEMPLATE_NAME, TEMPLATE_SOURCE, templateEvents, templateSlots } from "@/lib/pharmaTemplate";

/** Stundenplan, Prüfungen und Fristen für Pharmazie, 1. Semester, mit einem Klick übernehmen. */
export function TemplateSetup({ compact = false }: { compact?: boolean }) {
  const [group, setGroup] = useState<string>("");
  const [withEvents, setWithEvents] = useState(true);
  const [done, setDone] = useState(false);

  async function apply() {
    await putItems("slots", templateSlots(group || null));
    if (withEvents) await putItems("events", templateEvents());
    setDone(true);
  }

  if (done) return <p className="ok-note">Übernommen. Räume prüft Jarvis vor jeder Lektion live im Vorlesungsverzeichnis.</p>;

  return (
    <div className={compact ? "setup setup-compact" : "setup"}>
      {!compact && <h2>Stundenplan einrichten</h2>}
      <p className="muted" style={{ margin: 0, maxWidth: "62ch" }}>
        Vorlage <strong>{TEMPLATE_NAME}</strong> nach dem{" "}
        <a href={TEMPLATE_SOURCE} target="_blank" rel="noreferrer">
          Wochenplan des Departements
        </a>
        , inklusive provisorischer Examensdaten und der Frist für die Examensanmeldung. Einzelne Einträge kannst du danach
        ändern oder löschen.
      </p>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="field">
          <span>Deine Übungsgruppe Mathematik I</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">keine eintragen</option>
            {MATH_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={withEvents} onChange={(e) => setWithEvents(e.target.checked)} />
          Prüfungen und Fristen eintragen
        </label>
        <button className="btn btn-primary" onClick={apply}>
          Vorlage übernehmen
        </button>
      </div>
    </div>
  );
}
