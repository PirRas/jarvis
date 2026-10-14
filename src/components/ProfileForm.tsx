"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listItems, onLocalChange, putItems } from "@/lib/db";
import {
  BSC_YEARS,
  DEFAULT_PROFILE,
  levelLabel,
  MSC_YEARS,
  profileMark,
  readProfile,
  semesterAt,
  semesterKey,
  semesterLabel,
  studyLevel,
  type Degree,
  type Profile,
  type Term,
} from "@/lib/profile";
import { useRemoteRefresh } from "./SyncBadge";

/** Semester zur Auswahl als Studienbeginn: sechs Jahre zurück bis ein Jahr voraus. */
function semesterOptions(now: number) {
  const cur = semesterAt(now);
  const out: { term: Term; year: number }[] = [];
  for (let y = cur.year - 6; y <= cur.year + 1; y++) for (const term of ["FS", "HS"] as const) out.push({ term, year: y });
  return out.reverse();
}

const LEVELS: { degree: Degree; year: number }[] = [
  ...Array.from({ length: BSC_YEARS }, (_, i) => ({ degree: "BSc" as const, year: i + 1 })),
  ...Array.from({ length: MSC_YEARS }, (_, i) => ({ degree: "MSc" as const, year: i + 1 })),
];

export function ProfileForm() {
  const [saved, setSaved] = useState<Profile | null | undefined>();
  const [draft, setDraft] = useState<Profile>(DEFAULT_PROFILE);
  const [note, setNote] = useState("");
  const now = Date.now();

  const dirty = useRef(false); // angefangene Eingaben nicht durch Neuladen (Abgleich) überschreiben

  const load = useCallback(async () => {
    const p = readProfile(await listItems("marks"));
    setSaved(p);
    if (!dirty.current) setDraft(p ?? DEFAULT_PROFILE);
  }, []);
  useEffect(() => {
    load();
    return onLocalChange(load);
  }, [load]);
  useRemoteRefresh(load);

  if (saved === undefined) return null;

  const auto = studyLevel({ ...draft, level: undefined }, now);
  const current = studyLevel(draft, now);
  const set = (patch: Partial<Profile>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
    setNote("");
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    dirty.current = false;
    await putItems("marks", [profileMark({ ...draft, name: draft.name.trim(), program: draft.program.trim() })]);
    setNote("Gespeichert.");
  }

  return (
    <form id="profil" className="sheet stat-panel profile-form" onSubmit={save}>
      <h2>Profil</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Steht auf der Startseite. Das Studienjahr zählt Jarvis jedes Herbstsemester selbst weiter.
      </p>
      <label className="field">
        Name
        <input autoComplete="given-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Wie soll Jarvis dich nennen?" />
      </label>
      <label className="field">
        Studiengang
        <input value={draft.program} onChange={(e) => set({ program: e.target.value })} />
      </label>
      <div className="profile-pair">
        <label className="field">
          Abschluss bei Studienbeginn
          <select value={draft.degree} onChange={(e) => set({ degree: e.target.value as Degree })}>
            <option value="BSc">Bachelor (BSc)</option>
            <option value="MSc">Master (MSc)</option>
          </select>
        </label>
        <label className="field">
          Studienbeginn
          <select value={draft.start} onChange={(e) => set({ start: e.target.value })}>
            {semesterOptions(now).map((s) => (
              <option key={semesterKey(s)} value={semesterKey(s)}>
                {semesterLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Studienjahr
        <select
          value={current.manual ? levelLabel(current) : "auto"}
          onChange={(e) => {
            const pick = LEVELS.find((l) => levelLabel(l) === e.target.value);
            set({ level: pick ? { ...pick, at: semesterKey(semesterAt(now)) } : undefined });
          }}
        >
          <option value="auto">Automatisch ({levelLabel(auto)})</option>
          {LEVELS.map((l) => (
            <option key={levelLabel(l)} value={levelLabel(l)}>
              {levelLabel(l)}
            </option>
          ))}
        </select>
      </label>
      {current.manual && (
        <p className="muted small" style={{ margin: 0 }}>
          Selbst festgelegt. Ab dem nächsten Herbstsemester zählt Jarvis von hier aus weiter.
        </p>
      )}
      <div className="row">
        <button className="btn btn-primary">Profil speichern</button>
        {note && <span className="verdict-ok small">{note}</span>}
      </div>
    </form>
  );
}
