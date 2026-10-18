// Pharmakokinetik im Ein-Kompartiment-Modell mit Mehrfachgabe (Formeln wie im Skill pkpd-modeling).
// Annahme: Aufnahme sofort (i.v.-Bolus bzw. schnelle Resorption), lineare Elimination 1. Ordnung.

export type PkInput = {
  dose: number; // mg
  tau: number; // Dosierintervall, h
  tHalf: number; // Halbwertszeit, h
  vd: number; // Verteilungsvolumen, L
  f: number; // Bioverfügbarkeit, 0–1
};

export function pkSteadyState({ dose, tau, tHalf, vd, f }: PkInput) {
  for (const v of [dose, tau, tHalf, vd]) if (!(v > 0)) throw new Error("Dosis, Intervall, Halbwertszeit und Vd müssen grösser als 0 sein.");
  if (!(f > 0 && f <= 1)) throw new Error("Bioverfügbarkeit muss zwischen 1 und 100 % liegen.");
  const k = Math.LN2 / tHalf;
  const cl = k * vd; // L/h
  const r = 1 / (1 - Math.exp(-k * tau)); // Kumulationsfaktor
  const cMax = ((f * dose) / vd) * r;
  return {
    k,
    cl,
    r,
    cAvg: (f * dose) / (cl * tau), // mg/L
    cMax,
    cMin: cMax * Math.exp(-k * tau),
    t90: 3.32 * tHalf, // 90 % des Steady State
    loadingDose: dose * r, // erreicht Cmax,ss sofort
  };
}

/** Konzentrationsverlauf über `doses` Gaben (Überlagerung), pro Intervall Tal vor und Spitze nach der Gabe. */
export function pkCurve({ dose, tau, tHalf, vd, f }: PkInput, doses: number, perInterval = 30) {
  const k = Math.LN2 / tHalf;
  const c0 = (f * dose) / vd;
  const pts: { t: number; c: number }[] = [];
  for (let n = 0; n < doses; n++)
    for (let j = 0; j <= perInterval; j++) {
      const t = (n + j / perInterval) * tau;
      let c = 0;
      for (let i = 0; i <= n; i++) c += c0 * Math.exp(-k * (t - i * tau));
      pts.push({ t, c });
    }
  return pts;
}
