"use client";

import { useMemo, useState } from "react";
import {
  concentrationFrom,
  fmtNum,
  MASS_UNITS,
  massForMolarity,
  percentIonized,
  phBuffer,
  phStrongAcid,
  phStrongBase,
  phWeakAcid,
  phWeakBase,
  solveDilution,
  VOLUME_UNITS,
  type MassUnit,
  type VolumeUnit,
} from "@/lib/pharma/calculators";
import { molarMass } from "@/lib/pharma/formula";

/** "0,5" und "0.5" akzeptieren; leer → null. */
function num(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Führt eine Berechnung aus und fängt Fehlermeldungen ab. */
function attempt<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } | null {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function Calculators() {
  return (
    <div className="ph-calc-grid">
      <MolarMassCalc />
      <DilutionCalc />
      <ConcentrationCalc />
      <PhCalc />
    </div>
  );
}

// ---------- Molmasse ----------

function MolarMassCalc() {
  const [f, setF] = useState("CuSO4·5H2O");
  const res = useMemo(() => (f.trim() ? attempt(() => molarMass(f)) : null), [f]);
  return (
    <section className="sheet panel">
      <h2 className="panel-title">Molmasse</h2>
      <p className="muted small">Summenformel mit Klammern und Hydratwasser, z. B. Ca(OH)2, K4[Fe(CN)6], CuSO4·5H2O (· oder *).</p>
      <label className="field">
        <span>Summenformel</span>
        <input value={f} onChange={(e) => setF(e.target.value)} spellCheck={false} autoComplete="off" className="ph-mono" />
      </label>
      {res && !res.ok && <p className="error small">{res.error}</p>}
      {res?.ok && (
        <>
          <p className="ph-result">
            M = <strong>{res.value.mass.toFixed(2)} g/mol</strong>
          </p>
          <table className="ph-table">
            <thead>
              <tr>
                <th>Element</th>
                <th>Anzahl</th>
                <th>Masse</th>
                <th>Anteil</th>
              </tr>
            </thead>
            <tbody>
              {res.value.parts.map((p) => (
                <tr key={p.element}>
                  <td>{p.element}</td>
                  <td>{p.count}</td>
                  <td>{p.mass.toFixed(3)}</td>
                  <td>{p.percent.toFixed(2)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

// ---------- Verdünnung ----------

function DilutionCalc() {
  const [v, setV] = useState({ c1: "1", v1: "", c2: "0.1", v2: "100" });
  const [cUnit, setCUnit] = useState("mol/L");
  const [vUnit, setVUnit] = useState<VolumeUnit>("mL");
  const res = useMemo(() => {
    const d = { c1: num(v.c1), v1: num(v.v1), c2: num(v.c2), v2: num(v.v2) };
    if (Object.values(d).some((x) => Number.isNaN(x))) return { ok: false as const, error: "Bitte nur Zahlen eingeben." };
    if (Object.values(d).filter((x) => x === null).length !== 1) return null;
    return attempt(() => solveDilution(d));
  }, [v]);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const label = { c1: "Stammlösung c₁", v1: "Volumen Stammlösung V₁", c2: "Endkonzentration c₂", v2: "Endvolumen V₂" };
  return (
    <section className="sheet panel">
      <h2 className="panel-title">Verdünnung</h2>
      <p className="muted small">c₁ · V₁ = c₂ · V₂. Genau ein Feld leer lassen, es wird berechnet.</p>
      <div className="row">
        <label className="field">
          <span>Konzentration in</span>
          <select value={cUnit} onChange={(e) => setCUnit(e.target.value)}>
            {["mol/L", "mmol/L", "g/L", "mg/mL", "% (m/V)"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Volumen in</span>
          <select value={vUnit} onChange={(e) => setVUnit(e.target.value as VolumeUnit)}>
            {Object.keys(VOLUME_UNITS).map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid ph-two">
        {(Object.keys(label) as (keyof typeof v)[]).map((k) => (
          <label key={k} className="field">
            <span>
              {label[k]} ({k.startsWith("c") ? cUnit : vUnit})
            </span>
            <input inputMode="decimal" value={v[k]} onChange={set(k)} placeholder={res?.ok && res.value.key === k ? "wird berechnet" : ""} />
          </label>
        ))}
      </div>
      {res && !res.ok && <p className="error small">{res.error}</p>}
      {res?.ok && (
        <p className="ph-result">
          {label[res.value.key]} = <strong>{fmtNum(res.value.value)} {res.value.key.startsWith("c") ? cUnit : vUnit}</strong>
          {res.value.key === "v1" && num(v.v2) !== null && (
            <span className="muted small"> · mit {fmtNum(num(v.v2)! - res.value.value)} {vUnit} Lösungsmittel auffüllen</span>
          )}
        </p>
      )}
    </section>
  );
}

// ---------- Konzentration / Einwaage ----------

function ConcentrationCalc() {
  const [mode, setMode] = useState<"conc" | "mass">("conc");
  const [mass, setMass] = useState("5.844");
  const [mUnit, setMUnit] = useState<MassUnit>("g");
  const [vol, setVol] = useState("100");
  const [vUnit, setVUnit] = useState<VolumeUnit>("mL");
  const [mm, setMm] = useState("NaCl");
  const [molar, setMolar] = useState("0.5");

  // Molmasse: Zahl oder Summenformel
  const M = useMemo(() => {
    const n = num(mm);
    if (n !== null && !Number.isNaN(n)) return n > 0 ? n : null;
    const r = mm.trim() ? attempt(() => molarMass(mm).mass) : null;
    return r?.ok ? r.value : null;
  }, [mm]);

  const res = useMemo(() => {
    if (mode === "conc") {
      const m = num(mass);
      const v = num(vol);
      if (m === null || v === null) return null;
      return attempt(() => concentrationFrom(m, mUnit, v, vUnit, M));
    }
    return null;
  }, [mode, mass, mUnit, vol, vUnit, M]);

  const need = useMemo(() => {
    if (mode !== "mass") return null;
    const c = num(molar);
    const v = num(vol);
    if (c === null || v === null) return null;
    if (!M) return { ok: false as const, error: "Für die Einwaage braucht es die Molmasse (Zahl oder Summenformel)." };
    return attempt(() => massForMolarity(c, v, vUnit, M));
  }, [mode, molar, vol, vUnit, M]);

  return (
    <section className="sheet panel">
      <h2 className="panel-title">Konzentration und Einwaage</h2>
      <div className="tabs ph-subtabs" role="tablist">
        <button className="tab" role="tab" aria-selected={mode === "conc"} onClick={() => setMode("conc")}>
          Konzentration berechnen
        </button>
        <button className="tab" role="tab" aria-selected={mode === "mass"} onClick={() => setMode("mass")}>
          Einwaage berechnen
        </button>
      </div>
      <div className="form-grid ph-two">
        {mode === "conc" ? (
          <label className="field">
            <span>Masse gelöster Stoff</span>
            <div className="ph-unit">
              <input inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
              <select value={mUnit} onChange={(e) => setMUnit(e.target.value as MassUnit)} aria-label="Masseneinheit">
                {Object.keys(MASS_UNITS).map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
          </label>
        ) : (
          <label className="field">
            <span>Gewünschte Konzentration (mol/L)</span>
            <input inputMode="decimal" value={molar} onChange={(e) => setMolar(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>{mode === "conc" ? "Volumen der Lösung" : "Volumen, das du herstellen willst"}</span>
          <div className="ph-unit">
            <input inputMode="decimal" value={vol} onChange={(e) => setVol(e.target.value)} />
            <select value={vUnit} onChange={(e) => setVUnit(e.target.value as VolumeUnit)} aria-label="Volumeneinheit">
              {Object.keys(VOLUME_UNITS).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
        </label>
        <label className="field">
          <span>Molmasse (g/mol) oder Summenformel {mode === "conc" && "(optional)"}</span>
          <input value={mm} onChange={(e) => setMm(e.target.value)} spellCheck={false} />
          {M !== null && num(mm) === null && <small className="muted">M = {M.toFixed(2)} g/mol</small>}
        </label>
      </div>
      {res && !res.ok && <p className="error small">{res.error}</p>}
      {res?.ok && (
        <dl className="ph-dl ph-result-list">
          {res.value.molPerL !== null && (
            <>
              <dt>Stoffmengenkonzentration</dt>
              <dd>
                <strong>{fmtNum(res.value.molPerL)} mol/L</strong> = {fmtNum(res.value.mmolPerL!)} mmol/L
              </dd>
            </>
          )}
          <dt>Massenkonzentration</dt>
          <dd>
            <strong>{fmtNum(res.value.gPerL)} g/L</strong> = {fmtNum(res.value.mgPerMl)} mg/mL
          </dd>
          <dt>Prozent (m/V)</dt>
          <dd>
            <strong>{fmtNum(res.value.percentMV)} %</strong> (g pro 100 mL)
          </dd>
        </dl>
      )}
      {need && !need.ok && <p className="error small">{need.error}</p>}
      {need?.ok && (
        <p className="ph-result">
          Einwaage: <strong>{need.value >= 1 ? `${fmtNum(need.value)} g` : `${fmtNum(need.value * 1000)} mg`}</strong>
          <span className="muted small"> · im Messkolben lösen und auf {vol} {vUnit} auffüllen</span>
        </p>
      )}
    </section>
  );
}

// ---------- pH ----------

type PhMode = "strongAcid" | "strongBase" | "weakAcid" | "weakBase" | "buffer" | "ionized";

const PH_MODES: { value: PhMode; label: string }[] = [
  { value: "strongAcid", label: "Starke Säure" },
  { value: "strongBase", label: "Starke Base" },
  { value: "weakAcid", label: "Schwache Säure" },
  { value: "weakBase", label: "Schwache Base" },
  { value: "buffer", label: "Puffer" },
  { value: "ionized", label: "Ionisierungsgrad" },
];

function PhCalc() {
  const [mode, setMode] = useState<PhMode>("weakAcid");
  const [c, setC] = useState("0.1");
  const [pKa, setPKa] = useState("4.76");
  const [cB, setCB] = useState("0.1");
  const [cA, setCA] = useState("0.1");
  const [ph, setPh] = useState("7.4");
  const [kind, setKind] = useState<"acid" | "base">("acid");

  const res = useMemo(() => {
    const vc = num(c);
    const vk = num(pKa);
    return attempt(() => {
      const need = (...xs: (number | null)[]) => {
        if (xs.some((x) => x === null || Number.isNaN(x))) throw new Error("Bitte alle Felder mit Zahlen ausfüllen.");
      };
      switch (mode) {
        case "strongAcid":
          need(vc);
          return { pH: phStrongAcid(vc!), extra: "" };
        case "strongBase":
          need(vc);
          return { pH: phStrongBase(vc!), extra: "" };
        case "weakAcid": {
          need(vc, vk);
          const r = phWeakAcid(vc!, vk!);
          return { pH: r.pH, extra: `Dissoziationsgrad ${fmtNum(r.alpha * 100, 3)} % · Näherung ½(pKa − log c) = ${r.approx.toFixed(2)}` };
        }
        case "weakBase": {
          need(vc, vk);
          const r = phWeakBase(vc!, vk!);
          return { pH: r.pH, extra: `Protonierungsgrad ${fmtNum(r.alpha * 100, 3)} %` };
        }
        case "buffer":
          need(vk, num(cB), num(cA));
          return { pH: phBuffer(vk!, num(cB)!, num(cA)!), extra: "" };
        case "ionized": {
          need(vk, num(ph));
          const p = percentIonized(kind, vk!, num(ph)!);
          return { pH: null, extra: `${fmtNum(p, 4)} % ionisiert, ${fmtNum(100 - p, 4)} % neutral (lipophil, membrangängig)` };
        }
      }
    });
  }, [mode, c, pKa, cB, cA, ph, kind]);

  return (
    <section className="sheet panel">
      <h2 className="panel-title">pH-Wert</h2>
      <label className="field">
        <span>Rechnung</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as PhMode)}>
          {PH_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid ph-two" style={{ marginTop: 10 }}>
        {["strongAcid", "strongBase", "weakAcid", "weakBase"].includes(mode) && (
          <label className="field">
            <span>Konzentration (mol/L)</span>
            <input inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} />
          </label>
        )}
        {mode === "ionized" && (
          <label className="field">
            <span>Arzneistoff ist eine</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as "acid" | "base")}>
              <option value="acid">Säure (z. B. ASS, Ibuprofen)</option>
              <option value="base">Base (z. B. Lidocain, Morphin)</option>
            </select>
          </label>
        )}
        {["weakAcid", "weakBase", "buffer", "ionized"].includes(mode) && (
          <label className="field">
            <span>{mode === "weakBase" ? "pKa der korrespondierenden Säure (BH⁺)" : "pKa"}</span>
            <input inputMode="decimal" value={pKa} onChange={(e) => setPKa(e.target.value)} />
          </label>
        )}
        {mode === "buffer" && (
          <>
            <label className="field">
              <span>c(Base, A⁻) in mol/L</span>
              <input inputMode="decimal" value={cB} onChange={(e) => setCB(e.target.value)} />
            </label>
            <label className="field">
              <span>c(Säure, HA) in mol/L</span>
              <input inputMode="decimal" value={cA} onChange={(e) => setCA(e.target.value)} />
            </label>
          </>
        )}
        {mode === "ionized" && (
          <label className="field">
            <span>pH der Umgebung</span>
            <input inputMode="decimal" value={ph} onChange={(e) => setPh(e.target.value)} />
          </label>
        )}
      </div>
      {res && !res.ok && <p className="error small">{res.error}</p>}
      {res?.ok && (
        <>
          {res.value.pH !== null && (
            <p className="ph-result">
              pH = <strong>{res.value.pH.toFixed(2)}</strong>
            </p>
          )}
          {res.value.extra && <p className="small muted">{res.value.extra}</p>}
        </>
      )}
      <p className="small muted">Alle Werte bei 25 °C (pKw = 14). Schwache Säuren und Basen werden exakt (quadratisch) gerechnet.</p>
    </section>
  );
}
