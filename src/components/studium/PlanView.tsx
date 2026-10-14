"use client";

import { useState } from "react";
import type { CourseRecord } from "@/lib/assistant";
import { deleteItems, putItem } from "@/lib/db";
import {
  FAMULATUR_ID,
  FAMULATUR_INFO,
  FAMULATUR_LINK,
  isPassed,
  MODULES,
  PLAN,
  STAGES,
  validGrade,
  type PlanCourse,
  type Result,
  type Stage,
  type Summary,
} from "@/lib/studyPlan";

const fmt = (g: number | null) => (g === null ? "–" : g.toFixed(2));

function toRecord(c: PlanCourse, status: CourseRecord["status"], grade: number | undefined, createdAt?: number): CourseRecord {
  return {
    id: c.id,
    module: c.module,
    stage: c.stage,
    course: c.course,
    semester: c.semester,
    kp: c.kp,
    assessment: c.assessment,
    status,
    ...(grade !== undefined ? { grade } : {}),
    createdAt: createdAt ?? Date.now(),
  };
}

/** Speichert nur Abweichungen vom Ausgangszustand ("offen", ohne Note); sonst wird der Eintrag gelöscht. */
async function save(c: PlanCourse, status: CourseRecord["status"], grade: number | undefined, existing?: CourseRecord) {
  if (status === "offen" && grade === undefined) {
    if (existing) await deleteItems("grades", [c.id]);
    return;
  }
  await putItem("grades", toRecord(c, status, grade, existing?.createdAt));
}

function CourseRow({ c, rec, result, extra }: { c: PlanCourse; rec?: CourseRecord; result?: Result; extra?: boolean }) {
  const [gradeText, setGradeText] = useState(rec?.grade !== undefined ? String(rec.grade) : "");
  const [error, setError] = useState(false);
  const status = rec?.status ?? "offen";
  const passed = isPassed(result);
  const failed = !!result && !passed && (result.grade !== undefined || result.status === "nicht bestanden");

  function commitGrade() {
    const t = gradeText.trim().replace(",", ".");
    if (!t) {
      setError(false);
      if (rec?.grade !== undefined) save(c, status, undefined, rec);
      return;
    }
    const g = Number(t);
    if (!validGrade(g)) {
      setError(true);
      return;
    }
    setError(false);
    if (g !== rec?.grade) save(c, g >= 4 ? "bestanden" : "nicht bestanden", g, rec);
  }

  return (
    <li className={`st-course ${passed ? "is-passed" : failed ? "is-failed" : ""}`}>
      <div className="st-course-main">
        <div className="st-course-title">{c.course}</div>
        <div className="small muted">
          {c.semester} · {c.kp} KP · {c.assessment === "Examen" ? "Examen" : c.assessment === "Pass/Fail" ? "Pass/Fail" : "begleitend"}
        </div>
      </div>
      <div className="st-course-input">
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => save(c, e.target.value as CourseRecord["status"], rec?.grade, rec)}
        >
          <option value="offen">offen</option>
          <option value="bestanden">bestanden</option>
          <option value="nicht bestanden">nicht bestanden</option>
        </select>
        <input
          className={error ? "st-grade is-invalid" : "st-grade"}
          inputMode="decimal"
          placeholder="Note"
          aria-label="Note"
          title="Note 1–6 in halben Schritten (leer lassen bei Pass/Fail)"
          value={gradeText}
          onChange={(e) => setGradeText(e.target.value)}
          onBlur={commitGrade}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        {extra && (
          <button className="btn btn-quiet small" onClick={() => confirm(`„${c.course}“ entfernen?`) && deleteItems("grades", [c.id])}>
            Entfernen
          </button>
        )}
      </div>
      {error && <p className="error small st-course-error">Note zwischen 1 und 6 in ganzen oder halben Schritten (z. B. 4.5).</p>}
    </li>
  );
}

function AddElective() {
  const [course, setCourse] = useState("");
  const [kp, setKp] = useState("1");
  const [semester, setSemester] = useState("");
  const [assessment, setAssessment] = useState<CourseRecord["assessment"]>("Pass/Fail");

  async function add() {
    const n = Number(kp.replace(",", "."));
    if (!course.trim() || !(n > 0)) return;
    await putItem("grades", {
      id: `wahl-${crypto.randomUUID()}`,
      module: "Wahlbereich",
      stage: "Wahlbereich",
      course: course.trim(),
      semester: semester.trim(),
      kp: n,
      assessment,
      status: "offen",
      createdAt: Date.now(),
    });
    setCourse("");
    setSemester("");
  }

  return (
    <div className="form-grid st-add">
      <label className="field span-2">
        <span>Lehrveranstaltung (ausserhalb der Pharmazie)</span>
        <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="z. B. UPGRADE your digital skills" />
      </label>
      <label className="field">
        <span>KP</span>
        <input inputMode="decimal" value={kp} onChange={(e) => setKp(e.target.value)} />
      </label>
      <label className="field">
        <span>Semester</span>
        <input value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="z. B. HS26" />
      </label>
      <label className="field">
        <span>Prüfung</span>
        <select value={assessment} onChange={(e) => setAssessment(e.target.value as CourseRecord["assessment"])}>
          <option value="Pass/Fail">Pass/Fail</option>
          <option value="Examen">Examen</option>
          <option value="lehrveranstaltungsbegleitend">begleitend</option>
        </select>
      </label>
      <div className="row" style={{ alignSelf: "end" }}>
        <button className="btn" onClick={add} disabled={!course.trim()}>
          Hinzufügen
        </button>
      </div>
    </div>
  );
}

export function PlanView({
  records,
  results,
  extras,
  summary,
}: {
  records: CourseRecord[];
  results: Map<string, Result>;
  extras: PlanCourse[];
  summary: Summary;
}) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const [open, setOpen] = useState<Stage>("Grundstudium");
  const famulatur = byId.get(FAMULATUR_ID);

  return (
    <div className="st-plan">
      <p className="muted small">
        Trag nach jeder Prüfung Status oder Note ein. Noten in ganzen oder halben Schritten, bestanden ab 4.0. Modulnoten sind
        nach KP gewichtet; in Modulen mit mehreren Prüfungen zählen die KP einer ungenügenden Note, wenn die Modulnote
        genügend ist (Kompensation). Alles ohne Gewähr – massgebend sind die Online-Services.
      </p>

      <div className="tabs" role="tablist">
        {STAGES.map((s) => (
          <button key={s} className="tab" role="tab" aria-selected={open === s} onClick={() => setOpen(s)}>
            {s}
            <span className="count">
              {summary.byStage[s].earned}/{summary.byStage[s].total}
            </span>
          </button>
        ))}
      </div>

      {open !== "Wahlbereich" && summary.byStage[open].grade !== null && (
        <p className="st-stage-grade">
          Note {open}: <strong>{fmt(summary.byStage[open].grade)}</strong>
          <span className="small muted"> (Durchschnitt der Modulnoten{open === "1. Jahr Aufbaustudium" ? ": Biologie 2, Med. Biologie 2, Chemie 2" : ""})</span>
        </p>
      )}

      {open === "Wahlbereich" ? (
        <section className="sheet panel">
          <h3 className="panel-title">Wahlbereich (mind. 9 KP)</h3>
          <p className="small muted">
            Beliebige Lehrveranstaltungen ausserhalb der Pharmazie, z. B. Informatik, BWL, Sprachen. Tipp aus der Wegleitung: Der
            ADAM-Selbstlernkurs «UPGRADE your digital skills» gibt 1 KP.
          </p>
          {extras.length > 0 && (
            <ul className="st-courses">
              {extras.map((c) => (
                <CourseRow key={`${c.id}:${byId.get(c.id)?.grade ?? ""}`} c={c} rec={byId.get(c.id)} result={results.get(c.id)} extra />
              ))}
            </ul>
          )}
          <AddElective />
        </section>
      ) : (
        MODULES.filter((m) => m.stage === open).map((m) => {
          const ms = summary.modules.find((x) => x.module.name === m.name)!;
          return (
            <section key={m.name} className="sheet panel st-module">
              <div className="row spread">
                <h3 className="panel-title">{m.name}</h3>
                <span className="small">
                  {ms.earned}/{m.kp} KP · Modulnote <strong>{fmt(ms.grade)}</strong>
                  {ms.compensated && <span className="pill st-pill-comp"> kompensiert</span>}
                </span>
              </div>
              {!m.graded && <p className="small muted" style={{ margin: 0 }}>Zählt nicht zur Note dieser Stufe.</p>}
              <ul className="st-courses">
                {PLAN.filter((c) => c.module === m.name).map((c) => (
                  <CourseRow key={`${c.id}:${byId.get(c.id)?.grade ?? ""}`} c={c} rec={byId.get(c.id)} result={results.get(c.id)} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <section className="sheet panel st-famulatur">
        <div className="row spread">
          <h3 className="panel-title">Famulatur (Pflicht-Nachweis, ohne KP)</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={famulatur?.status === "bestanden"}
              onChange={(e) =>
                e.target.checked
                  ? putItem("grades", {
                      id: FAMULATUR_ID,
                      module: "Nachweise",
                      stage: "2. Jahr Aufbaustudium",
                      course: "Famulatur",
                      semester: "",
                      kp: 0,
                      assessment: "Pass/Fail",
                      status: "bestanden",
                      createdAt: famulatur?.createdAt ?? Date.now(),
                    })
                  : deleteItems("grades", [FAMULATUR_ID])
              }
            />
            Bestätigung abgegeben
          </label>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {FAMULATUR_INFO}{" "}
          <a href={FAMULATUR_LINK} target="_blank" rel="noreferrer">
            Mehr dazu
          </a>
        </p>
      </section>
    </div>
  );
}
