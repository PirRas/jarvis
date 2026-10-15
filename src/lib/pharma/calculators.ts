// Rechner für Labor und Analytik: Verdünnung, Konzentration, pH. Reine Funktionen, alle Werte bei 25 °C.

const KW = 1e-14; // Ionenprodukt des Wassers bei 25 °C

// ---------- Einheiten ----------

export const VOLUME_UNITS = { L: 1, mL: 1e-3, "µL": 1e-6 } as const;
export type VolumeUnit = keyof typeof VOLUME_UNITS;

export const MASS_UNITS = { g: 1, mg: 1e-3, "µg": 1e-6 } as const;
export type MassUnit = keyof typeof MASS_UNITS;

// ---------- Verdünnung: c1 · V1 = c2 · V2 ----------

export type Dilution = { c1: number | null; v1: number | null; c2: number | null; v2: number | null };

/** Berechnet die eine fehlende Grösse. Konzentrationen und Volumina je in derselben Einheit. */
export function solveDilution(d: Dilution): { key: keyof Dilution; value: number } {
  const missing = (Object.keys(d) as (keyof Dilution)[]).filter((k) => d[k] === null);
  if (missing.length !== 1) throw new Error("Genau ein Feld leer lassen; das wird berechnet.");
  const { c1, v1, c2, v2 } = d;
  for (const v of [c1, v1, c2, v2]) if (v !== null && !(v > 0)) throw new Error("Alle Werte müssen grösser als 0 sein.");
  const key = missing[0];
  const value =
    key === "c1" ? (c2! * v2!) / v1! : key === "v1" ? (c2! * v2!) / c1! : key === "c2" ? (c1! * v1!) / v2! : (c1! * v1!) / c2!;
  if (key === "c2" && value > c1!) throw new Error("Unmöglich: Die Endkonzentration wäre höher als die Stammlösung.");
  if (key === "v1" && value > v2!) throw new Error("Unmöglich: Es bräuchte mehr Stammlösung als Endvolumen. Ist die Stammlösung zu verdünnt?");
  return { key, value };
}

// ---------- Konzentration ----------

export type Concentrations = {
  molPerL: number | null; // nur mit Molmasse
  mmolPerL: number | null;
  gPerL: number;
  mgPerMl: number; // = g/L
  percentMV: number; // % (m/V) = g pro 100 mL
};

/** Masse gelöst in Volumen → alle gängigen Konzentrationsangaben. */
export function concentrationFrom(mass: number, massUnit: MassUnit, volume: number, volumeUnit: VolumeUnit, molarMass?: number | null) {
  if (!(mass > 0) || !(volume > 0)) throw new Error("Masse und Volumen müssen grösser als 0 sein.");
  const g = mass * MASS_UNITS[massUnit];
  const L = volume * VOLUME_UNITS[volumeUnit];
  const gPerL = g / L;
  const molPerL = molarMass && molarMass > 0 ? gPerL / molarMass : null;
  return {
    molPerL,
    mmolPerL: molPerL === null ? null : molPerL * 1000,
    gPerL,
    mgPerMl: gPerL,
    percentMV: gPerL / 10,
  } satisfies Concentrations;
}

/** Einwaage für eine gewünschte Stoffmengenkonzentration: m = c · V · M (Ergebnis in g). */
export function massForMolarity(molPerL: number, volume: number, volumeUnit: VolumeUnit, molarMass: number) {
  if (!(molPerL > 0) || !(volume > 0) || !(molarMass > 0)) throw new Error("Alle Werte müssen grösser als 0 sein.");
  return molPerL * volume * VOLUME_UNITS[volumeUnit] * molarMass;
}

// ---------- pH ----------

const pFrom = (h: number) => -Math.log10(h);

/** Starke Säure (vollständig dissoziiert), inkl. Autoprotolyse des Wassers – stimmt auch bei sehr kleinen c. */
export function phStrongAcid(c: number) {
  if (!(c > 0)) throw new Error("Konzentration muss grösser als 0 sein.");
  return pFrom((c + Math.sqrt(c * c + 4 * KW)) / 2);
}

export function phStrongBase(c: number) {
  if (!(c > 0)) throw new Error("Konzentration muss grösser als 0 sein.");
  const oh = (c + Math.sqrt(c * c + 4 * KW)) / 2;
  return 14 - pFrom(oh);
}

/** Schwache Säure HA: exakte Lösung von x² / (c − x) = Ka (Wasser vernachlässigt). */
export function phWeakAcid(c: number, pKa: number) {
  if (!(c > 0)) throw new Error("Konzentration muss grösser als 0 sein.");
  const ka = 10 ** -pKa;
  const h = (-ka + Math.sqrt(ka * ka + 4 * ka * c)) / 2;
  return { pH: pFrom(h), alpha: h / c, approx: (pKa - Math.log10(c)) / 2 };
}

/** Schwache Base B mit pKa der korrespondierenden Säure BH⁺ (so stehen Werte meist in Tabellen). */
export function phWeakBase(c: number, pKaOfAcid: number) {
  if (!(c > 0)) throw new Error("Konzentration muss grösser als 0 sein.");
  const kb = KW / 10 ** -pKaOfAcid;
  const oh = (-kb + Math.sqrt(kb * kb + 4 * kb * c)) / 2;
  return { pH: 14 - pFrom(oh), alpha: oh / c };
}

/** Puffer nach Henderson-Hasselbalch: pH = pKa + log(c(Base) / c(Säure)). */
export function phBuffer(pKa: number, cBase: number, cAcid: number) {
  if (!(cBase > 0) || !(cAcid > 0)) throw new Error("Beide Konzentrationen müssen grösser als 0 sein.");
  return pKa + Math.log10(cBase / cAcid);
}

/** Anteil ionisiert (%) bei gegebenem pH – wichtig für Resorption und Verteilung von Arzneistoffen. */
export function percentIonized(kind: "acid" | "base", pKa: number, pH: number) {
  return kind === "acid" ? 100 / (1 + 10 ** (pKa - pH)) : 100 / (1 + 10 ** (pH - pKa));
}

// ---------- Anzeige ----------

/** Zahl mit sinnvoller Genauigkeit, Schweizer Format (Dezimalpunkt). */
export function fmtNum(x: number, digits = 4) {
  if (!Number.isFinite(x)) return "–";
  const abs = Math.abs(x);
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e6)) return x.toExponential(digits - 1).replace("e", " · 10^").replace("^+", "^");
  return x.toLocaleString("de-CH", { maximumSignificantDigits: digits });
}
