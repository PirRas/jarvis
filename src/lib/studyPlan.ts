// Studienplan Bachelor Pharmazeutische Wissenschaften, Universität Basel (Wegleitung ab HS 2025)
// https://pharma.unibas.ch/fileadmin/user_upload/pharma/Teaching/BSc_Pharm._Wiss/StuO-WL/Wegleitung_BSc_Pharma_ab_HS_2025.pdf
// Notenregeln: Ordnung der Phil.-Nat. Fakultät für das Bachelorstudium (446.710), § 9:
// Skala 6.0–1.0, bestanden ab 4.0, ganze oder halbe Noten; Durchschnitte auf zwei Stellen (halbe Hundertstel aufrunden).
//
// Hinweis zur Quelle: In der PDF-Tabelle stehen die KP-Zahlen teilweise eine Zeile versetzt zu den Titeln.
// Wo die Zuordnung nicht eindeutig lesbar ist, steht ein Kommentar ("unsicher"). Die Modulsummen stimmen
// in jedem Fall mit den Modul-KP der Wegleitung überein (siehe checkPlan()).

import type { CourseRecord } from "./assistant";

export type Stage = "Grundstudium" | "1. Jahr Aufbaustudium" | "2. Jahr Aufbaustudium" | "Wahlbereich";
export type Assessment = CourseRecord["assessment"];

export type PlanCourse = {
  id: string;
  stage: Stage;
  module: string;
  course: string;
  semester: string;
  kp: number;
  assessment: Assessment;
};

export type PlanModule = { stage: Stage; name: string; kp: number; graded: boolean }; // graded: zählt für die Stufennote

export const TOTAL_KP = 180;
export const STAGE_KP: Record<Stage, number> = {
  Grundstudium: 58,
  "1. Jahr Aufbaustudium": 59,
  "2. Jahr Aufbaustudium": 54,
  Wahlbereich: 9,
};
export const STAGES: Stage[] = ["Grundstudium", "1. Jahr Aufbaustudium", "2. Jahr Aufbaustudium", "Wahlbereich"];

const G: Stage = "Grundstudium";
const A1: Stage = "1. Jahr Aufbaustudium";
const A2: Stage = "2. Jahr Aufbaustudium";
const EX = "Examen" as const;
const LB = "lehrveranstaltungsbegleitend" as const;

export const MODULES: PlanModule[] = [
  { stage: G, name: "Pharmazeutische Wissenschaften 1", kp: 9, graded: true },
  { stage: G, name: "Mathematik für Pharmazeutische Wissenschaften", kp: 12, graded: true },
  { stage: G, name: "Physik für Pharmazeutische Wissenschaften", kp: 11, graded: true },
  { stage: G, name: "Chemie 1 für Pharmazeutische Wissenschaften", kp: 14, graded: true },
  { stage: G, name: "Biologie 1 für Pharmazeutische Wissenschaften", kp: 3, graded: true },
  { stage: G, name: "Medizinische Biologie 1 für Pharmazeutische Wissenschaften", kp: 9, graded: true },
  // 1. Jahr Aufbaustudium: Note nur aus Biologie 2, Medizinische Biologie 2 und Chemie 2
  { stage: A1, name: "Pharmazeutische Wissenschaften 2", kp: 2, graded: false },
  { stage: A1, name: "Biologie 2 für Pharmazeutische Wissenschaften", kp: 9, graded: true },
  { stage: A1, name: "Medizinische Biologie 2 für Pharmazeutische Wissenschaften", kp: 4, graded: true },
  { stage: A1, name: "Chemie 2 für Pharmazeutische Wissenschaften", kp: 11, graded: true },
  { stage: A1, name: "Praktikum Chemie für Pharmazeutische Wissenschaften", kp: 29, graded: false },
  { stage: A1, name: "Überfachliche Kompetenzen", kp: 4, graded: false },
  { stage: A2, name: "Molekulare Pharmazie", kp: 15, graded: true },
  { stage: A2, name: "Pharmazeutische Technologie", kp: 15, graded: true },
  { stage: A2, name: "Pharmakologie und Toxikologie", kp: 11, graded: true },
  { stage: A2, name: "Pharmazeutische Biologie", kp: 6, graded: true },
  { stage: A2, name: "Biopharmazie und Analytik", kp: 7, graded: true },
];

const c = (id: string, stage: Stage, module: string, course: string, semester: string, kp: number, assessment: Assessment): PlanCourse => ({
  id: `plan-${id}`,
  stage,
  module,
  course,
  semester,
  kp,
  assessment,
});

const [PW1, MA, PH, CH1, BIO1, MB1] = MODULES.slice(0, 6).map((m) => m.name);
const [PW2, BIO2, MB2, CH2, PRC, UEK] = MODULES.slice(6, 12).map((m) => m.name);
const [MOL, TECH, PHT, PBIO, BPA] = MODULES.slice(12).map((m) => m.name);

export const PLAN: PlanCourse[] = [
  // ---------- Grundstudium (58 KP) ----------
  // unsicher: Reihenfolge 4/5 KP. Die KP-Spalte ist eine Zeile versetzt; so gelesen erhält die Hauptvorlesung
  // mit Praktikum (Arznei- und Giftpflanzen) 5 KP, die Einführung 4 KP.
  c("pw1-einfuehrung", G, PW1, "Einführung in die Pharmazeutischen Wissenschaften (Jahreskurs)", "1. + 2. Sem.", 4, EX),
  c("pw1-arzneipflanzen", G, PW1, "Organisation und Systematik der Arznei- und Giftpflanzen (Jahreskurs, mit Praktikum)", "1. + 2. Sem.", 5, EX),
  c("ma-1", G, MA, "Mathematik I für Naturwissenschaften (mit Übung)", "1. Sem.", 6, EX),
  c("ma-2", G, MA, "Mathematik II für Naturwissenschaften (mit Übung)", "2. Sem.", 6, EX),
  c("ph-1", G, PH, "Einführung in die Physik I", "1. Sem.", 6, EX),
  c("ph-2", G, PH, "Einführung in die Physik II", "2. Sem.", 5, EX),
  c("ch1-chemie", G, CH1, "Einführung in die Chemie I (mit Übung)", "1. Sem.", 6, EX),
  c("ch1-analytik1", G, CH1, "Analytische Chemie I: Quantitative Analytik (Jahreskurs)", "1. + 2. Sem.", 2, EX),
  c("ch1-oc", G, CH1, "Grundlagen der organischen Chemie", "2. Sem.", 4, EX),
  c("ch1-oc-uebung", G, CH1, "Übung: Grundlagen der organischen Chemie", "2. Sem.", 2, LB),
  c("bio1-mikroorganismen", G, BIO1, "Vielfalt und Ökologie der Mikroorganismen", "1. Sem.", 1, EX),
  c("bio1-cellbio", G, BIO1, "Cell Biology", "2. Sem.", 2, EX),
  c("mb1-anatomie", G, MB1, "Anatomie (Jahreskurs)", "1. + 2. Sem.", 4, EX),
  c("mb1-physiologie", G, MB1, "Physiologie (Jahreskurs)", "1. + 2. Sem.", 4, EX),
  c("mb1-physiologie-praktikum", G, MB1, "Praktikum: Physiologie", "2. Sem.", 1, LB),

  // ---------- 1. Jahr Aufbaustudium (59 KP) ----------
  c("pw2-drogen", A1, PW2, "Praktikum: Analyse von pflanzlichen Drogen", "3. Sem.", 2, LB),
  // unsicher: KP-Folge 2, 2, 1, 2, 2 in Titelreihenfolge zugeordnet (Immunologie = 1 KP).
  c("bio2-makromolekuele", A1, BIO2, "Makromoleküle, Grundlagen der Genetik und Gen-Expression", "3. Sem.", 2, EX),
  c("bio2-biochemistry", A1, BIO2, "Biochemistry – Molecular Principles of Life", "3. Sem.", 2, EX),
  c("bio2-immunologie", A1, BIO2, "Immunologie", "4. Sem.", 1, EX),
  c("bio2-neurobiologie", A1, BIO2, "Neurobiologie", "4. Sem.", 2, EX),
  c("bio2-strukturbiologie", A1, BIO2, "Strukturbiologie für Pharmazeutische Wissenschaften", "4. Sem.", 2, EX),
  c("mb2-mikrobiologie", A1, MB2, "Medizinische Mikrobiologie", "3. Sem.", 2, EX),
  c("mb2-praktikum", A1, MB2, "Praktikum: Medizinische Mikrobiologie und Mikroskopie (Allgemeine Histologie)", "3. Sem.", 1, LB),
  c("mb2-humangenetik", A1, MB2, "Humangenetik", "4. Sem.", 1, EX),
  // unsicher: Analytik III/IV – die 2 KP und 1 KP (begleitend) in Titelreihenfolge zugeordnet.
  c("ch2-oc1", A1, CH2, "Organische Chemie I: Einführung in die Organische Chemie (mit Übung)", "3. Sem.", 4, EX),
  c("ch2-physchem", A1, CH2, "Physical Chemistry (mit Übung)", "3. Sem.", 3, EX),
  c("ch2-analytik2", A1, CH2, "Analytische Chemie II: Einführung in die Pharmakopöe", "3. Sem.", 1, EX),
  c("ch2-analytik3", A1, CH2, "Analytische Chemie III: Strukturaufklärung", "3. Sem.", 2, LB),
  c("ch2-analytik4", A1, CH2, "Analytische Chemie IV: Grundlagen der Wirkstoff-Evaluation", "4. Sem.", 1, LB),
  c("prc-allgemein", A1, PRC, "Praktikum: Allgemeine Chemie", "3. Sem.", 8, LB),
  c("prc-physchem", A1, PRC, "Praktikum: Physikalische Chemie", "3. Sem.", 3, LB),
  c("prc-analytik", A1, PRC, "Praktikum: Analytische Chemie", "4. Sem.", 8, LB),
  c("prc-oc", A1, PRC, "Praktikum: Grundlagen der präparativen organischen Chemie", "4. Sem.", 10, LB),
  c("uek-bioethik", A1, UEK, "Grundlagen der Bioethik (mit Übungen)", "4. Sem.", 3, LB),
  c("uek-praesentation", A1, UEK, "Seminar: Auftritts- und Präsentationskompetenz", "4. Sem.", 1, LB),

  // ---------- 2. Jahr Aufbaustudium (54 KP) ----------
  c("mol-mechanismen", A2, MOL, "Molekulare Wirkstoff-Mechanismen, Teile A & B (Jahreskurs)", "5. + 6. Sem.", 4, EX),
  c("mol-seminar-a", A2, MOL, "Seminar: Molekulare Wirkstoffmechanismen, Teil A", "5. Sem.", 1, LB),
  c("mol-modeling", A2, MOL, "Einführung ins Molecular Modeling", "5. Sem.", 1, LB),
  c("mol-drugdesign", A2, MOL, "Praktikum: Pharmazeutische Chemie – Modern Drug Design (Jahreskurs)", "5. + 6. Sem.", 8, LB),
  c("mol-seminar-b", A2, MOL, "Seminar: Molekulare Wirkstoff-Mechanismen, Teil B", "6. Sem.", 1, LB),
  c("tech-arzneiformen", A2, TECH, "Arzneiformenlehre (feste, flüssige und disperse Arzneiformen, Jahreskurs)", "5. + 6. Sem.", 5, EX),
  c("tech-seminar", A2, TECH, "Seminar: Arzneiformenlehre (Jahreskurs)", "5. + 6. Sem.", 2, LB),
  c("tech-praktikum", A2, TECH, "Praktikum: Pharmazeutische Technologie (Jahreskurs)", "5. + 6. Sem.", 8, LB),
  // unsicher: KP-Folge 1, 2, 8 in Titelreihenfolge zugeordnet (Pathophysiologie/Pharmakologie = 8 KP).
  c("pht-toxikologie", A2, PHT, "Allgemeine Toxikologie", "5. Sem.", 1, EX),
  c("pht-epidemiologie", A2, PHT, "Epidemiologische Konzepte in der Arzneimittelforschung (Jahreskurs)", "5. + 6. Sem.", 2, EX),
  c("pht-pharmakologie", A2, PHT, "Grundlagen der Pathophysiologie, Pharmakologie und Pharmakotherapie (Jahreskurs)", "5. + 6. Sem.", 8, EX),
  c("pbio", A2, PBIO, "Pharmazeutische Biologie", "5. + 6. Sem.", 6, EX),
  // unsicher: In diesem Modul sind Semester und Prüfungsart in der PDF stark versetzt; KP-Folge 2, 1, 1, 1, 1, 1.
  c("bpa-biopharmazie", A2, BPA, "Biopharmazie", "5. Sem.", 2, EX),
  c("bpa-biopharmazie-uebung", A2, BPA, "Übung: Biopharmazie", "5. Sem.", 1, LB),
  c("bpa-metabolismus", A2, BPA, "Metabolismus von Arzneistoffen", "5. Sem.", 1, EX),
  c("bpa-analytik5", A2, BPA, "Analytische Chemie V: Klinische Diagnostik", "5. Sem.", 1, LB),
  c("bpa-analytik6", A2, BPA, "Analytische Chemie VI: Anwendungen in der Arzneimittelforschung", "6. Sem.", 1, LB),
  c("bpa-qualitaet", A2, BPA, "Qualitätsmanagement in der pharmazeutischen Praxis", "6. Sem.", 1, EX),
];

/** Pflicht-Nachweis ohne KP: Famulatur (zwei Wochen, Weisungen von pharmaSuisse). */
export const FAMULATUR_ID = "plan-famulatur";
export const FAMULATUR_INFO =
  "Zweiwöchiges Praktikum in einer Schweizer Apotheke: eine Woche in einer öffentlichen Offizinapotheke, die zweite dort, in einer anderen Offizin- oder in einer Spitalapotheke. Pflicht bis zum Abschluss des Bachelors (pharmaSuisse empfiehlt ab dem 2. Studienjahr). Die Bestätigung geht ans Studiendekanat der Phil.-Nat. Fakultät.";
export const FAMULATUR_LINK = "https://pharma.unibas.ch/de/education/bsc-pharm-wissenschaften/famulatur/";

// ---------- Berechnungen ----------

export type Result = { id: string; status: CourseRecord["status"]; grade?: number };

/** Note in ganzen oder halben Schritten zwischen 1 und 6? */
export function validGrade(g: number) {
  return g >= 1 && g <= 6 && Math.round(g * 2) === g * 2;
}

/** Auf zwei Stellen runden, halbe Hundertstel aufrunden (§ 9 Abs. 4). */
export function round2(x: number) {
  return Math.round((x + 1e-9) * 100) / 100;
}

/** Bestanden? Eine eingetragene Note entscheidet, sonst der Status. */
export function isPassed(r: Result | undefined) {
  if (!r) return false;
  if (r.grade !== undefined) return r.grade >= 4;
  return r.status === "bestanden";
}

const hasResult = (r: Result | undefined) => !!r && (r.grade !== undefined || r.status !== "offen");

/** Modulnote: nach KP gewichteter Durchschnitt der benoteten Leistungen; null ohne Noten. */
export function moduleGrade(courses: PlanCourse[], results: Map<string, Result>) {
  let sum = 0;
  let kp = 0;
  for (const c of courses) {
    const g = results.get(c.id)?.grade;
    if (g === undefined) continue;
    sum += g * c.kp;
    kp += c.kp;
  }
  return kp ? round2(sum / kp) : null;
}

/**
 * Erworbene KP einer Veranstaltung. Kompensation: In Modulen mit mehreren Leistungsüberprüfungen zählen
 * ungenügend benotete Leistungen, wenn die Modulnote genügend ist.
 */
export function earnedKp(course: PlanCourse, moduleCourses: PlanCourse[], results: Map<string, Result>) {
  const r = results.get(course.id);
  if (isPassed(r)) return course.kp;
  if (r?.grade === undefined || moduleCourses.length < 2) return 0;
  const mg = moduleGrade(moduleCourses, results);
  return mg !== null && mg >= 4 && moduleCourses.every((c) => hasResult(results.get(c.id))) ? course.kp : 0;
}

export type Summary = {
  earned: number;
  byStage: Record<Stage, { earned: number; total: number; grade: number | null; open: number }>;
  modules: { module: PlanModule; grade: number | null; earned: number; compensated: boolean }[];
};

/** Fasst alles zusammen: KP gesamt und pro Stufe, Modulnoten, Stufennoten (Durchschnitt der Modulnoten). */
export function summarize(plan: PlanCourse[], results: Map<string, Result>, extras: PlanCourse[] = []): Summary {
  const byStage = Object.fromEntries(
    STAGES.map((s) => [s, { earned: 0, total: STAGE_KP[s], grade: null as number | null, open: 0 }]),
  ) as Summary["byStage"];
  const modules: Summary["modules"] = [];

  for (const m of MODULES) {
    const courses = plan.filter((c) => c.module === m.name);
    const grade = moduleGrade(courses, results);
    let earned = 0;
    let compensated = false;
    for (const c of courses) {
      const kp = earnedKp(c, courses, results);
      earned += kp;
      if (kp && !isPassed(results.get(c.id))) compensated = true;
      if (!hasResult(results.get(c.id))) byStage[m.stage].open++;
    }
    byStage[m.stage].earned += earned;
    modules.push({ module: m, grade, earned, compensated });
  }

  // Stufennote: Durchschnitt der Noten der notenrelevanten Module (nur Module mit Note)
  for (const s of STAGES) {
    const grades = modules.filter((x) => x.module.stage === s && x.module.graded && x.grade !== null).map((x) => x.grade!);
    byStage[s].grade = grades.length ? round2(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
  }

  for (const e of extras) {
    if (isPassed(results.get(e.id))) byStage.Wahlbereich.earned += e.kp;
    else if (!hasResult(results.get(e.id))) byStage.Wahlbereich.open++;
  }

  const earned = STAGES.reduce((a, s) => a + byStage[s].earned, 0);
  return { earned, byStage, modules };
}

/** Selbsttest: Modulsummen = Modul-KP, Stufensummen = Stufen-KP. Gibt Fehlermeldungen zurück (leer = ok). */
export function checkPlan() {
  const errors: string[] = [];
  for (const m of MODULES) {
    const sum = PLAN.filter((c) => c.module === m.name).reduce((a, c) => a + c.kp, 0);
    if (sum !== m.kp) errors.push(`${m.name}: ${sum} statt ${m.kp} KP`);
  }
  for (const s of STAGES.slice(0, 3)) {
    const sum = MODULES.filter((m) => m.stage === s).reduce((a, m) => a + m.kp, 0);
    if (sum !== STAGE_KP[s]) errors.push(`${s}: ${sum} statt ${STAGE_KP[s]} KP`);
  }
  const ids = new Set(PLAN.map((c) => c.id));
  if (ids.size !== PLAN.length) errors.push("doppelte IDs");
  if (STAGES.reduce((a, s) => a + STAGE_KP[s], 0) !== TOTAL_KP) errors.push("Total ≠ 180 KP");
  return errors;
}
