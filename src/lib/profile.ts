// Profil: Name, Studiengang, Abschluss und Studienjahr, aktuelles Semester.
// Liegt als Markierung "profile" im abgeglichenen Bereich, damit es auf allen Geräten gleich ist.
// Das Studienjahr rechnet Jarvis selbst weiter: jedes Herbstsemester ein Jahr mehr, nach BSc 3 kommt MSc 1.
// Wer es selbst festlegt, setzt damit einen neuen Ausgangspunkt; von dort zählt Jarvis wieder weiter.

import type { Mark } from "./assistant";

export type Degree = "BSc" | "MSc";
export type Term = "HS" | "FS";

export type Profile = {
  name: string;
  program: string; // z. B. "Pharmazeutische Wissenschaften"
  degree: Degree; // Abschluss zu Studienbeginn
  start: string; // Studienbeginn, z. B. "HS2026"
  /** Selbst festgelegtes Studienjahr, gültig ab Semester `at` (z. B. "HS2027"). */
  level?: { degree: Degree; year: number; at: string };
};

const PROFILE_ID = "profile";
export const BSC_YEARS = 3;
export const MSC_YEARS = 2;

export const DEFAULT_PROFILE: Profile = {
  name: "",
  program: "Pharmazeutische Wissenschaften",
  degree: "BSc",
  start: "HS2026",
};

/** Semester eines Zeitpunkts: Herbstsemester August bis Januar, Frühjahrsemester Februar bis Juli. */
export function semesterAt(ms: number): { term: Term; year: number } {
  const d = new Date(ms);
  const m = d.getMonth() + 1;
  if (m >= 8) return { term: "HS", year: d.getFullYear() };
  if (m === 1) return { term: "HS", year: d.getFullYear() - 1 };
  return { term: "FS", year: d.getFullYear() };
}

export const semesterKey = (s: { term: Term; year: number }) => `${s.term}${s.year}`;
export const semesterLabel = (s: { term: Term; year: number }) => `${s.term} ${s.year}`;

function parseSemester(key: string): { term: Term; year: number } | null {
  const m = /^(HS|FS)\s?(\d{4})$/.exec(key.trim().toUpperCase());
  return m ? { term: m[1] as Term, year: Number(m[2]) } : null;
}

/** Studienjahr, in dem ein Semester liegt: HS 2026 und FS 2027 gehören zu 2026. */
const academicYear = (s: { term: Term; year: number }) => (s.term === "HS" ? s.year : s.year - 1);

/** Abschluss und Studienjahr zum Zeitpunkt `now`, aus Studienbeginn oder selbst gesetztem Ausgangspunkt. */
export function studyLevel(p: Profile, now = Date.now()): { degree: Degree; year: number; manual: boolean } {
  const anchor = p.level ? { degree: p.level.degree, year: p.level.year, at: p.level.at } : { degree: p.degree, year: 1, at: p.start };
  const from = parseSemester(anchor.at) ?? semesterAt(now);
  let year = anchor.year + Math.max(0, academicYear(semesterAt(now)) - academicYear(from));
  let degree = anchor.degree;
  if (degree === "BSc" && year > BSC_YEARS) {
    degree = "MSc";
    year -= BSC_YEARS;
  }
  if (degree === "MSc") year = Math.min(year, MSC_YEARS);
  return { degree, year: Math.max(1, year), manual: !!p.level };
}

export const levelLabel = (l: { degree: Degree; year: number }) => `${l.degree} ${l.year}`;

type ProfileMark = Mark & { profile?: Partial<Profile> };

export function readProfile(marks: Mark[]): Profile | null {
  const m = marks.find((x) => x.id === PROFILE_ID) as ProfileMark | undefined;
  return m?.profile ? { ...DEFAULT_PROFILE, ...m.profile } : null;
}

export function profileMark(profile: Profile): ProfileMark {
  return { id: PROFILE_ID, createdAt: Date.now(), profile };
}
