// Molmasse aus einer Summenformel, z. B. "C6H12O6", "Ca(OH)2", "CuSO4·5H2O".
// Atommassen: IUPAC-Standardwerte (konventionelle Werte, g/mol).

const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.18,
  Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.95, K: 39.098, Ca: 40.078,
  Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38,
  Ga: 69.723, Ge: 72.63, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798, Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224,
  Nb: 92.906, Mo: 95.95, Tc: 98, Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41, In: 114.82, Sn: 118.71,
  Sb: 121.76, Te: 127.6, I: 126.9, Xe: 131.29, Cs: 132.91, Ba: 137.33, La: 138.91, Ce: 140.12, Gd: 157.25, W: 183.84,
  Pt: 195.08, Au: 196.97, Hg: 200.59, Tl: 204.38, Pb: 207.2, Bi: 208.98, U: 238.03,
};

export type FormulaResult = {
  mass: number; // g/mol
  counts: Record<string, number>; // Atome pro Formeleinheit
  parts: { element: string; count: number; mass: number; percent: number }[];
};

const SUB: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

/** Zerlegt eine Summenformel; wirft einen Fehler mit verständlicher Meldung. */
function parseFormula(input: string): Record<string, number> {
  const src = input.replace(/[₀-₉]/g, (d) => SUB[d]).replace(/\s+/g, "");
  if (!src) throw new Error("Bitte eine Summenformel eingeben.");
  const total: Record<string, number> = {};
  // Hydrate und Addukte: "CuSO4·5H2O", "CuSO4*5H2O", "CuSO4.5H2O"
  for (const raw of src.split(/[·•*.]/)) {
    if (!raw) throw new Error("Unvollständige Formel bei „·“.");
    const m = /^(\d+)(.*)$/.exec(raw);
    const factor = m ? Number(m[1]) : 1;
    const part = m ? m[2] : raw;
    if (!part) throw new Error(`Nach der Zahl ${factor} fehlt die Formel.`);
    const counts = parseGroup(part);
    for (const [el, n] of Object.entries(counts)) total[el] = (total[el] ?? 0) + n * factor;
  }
  return total;
}

function parseGroup(s: string): Record<string, number> {
  const stack: Record<string, number>[] = [{}];
  const opening: string[] = [];
  let i = 0;
  const readNum = () => {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) return 1;
    i += m[0].length;
    return Number(m[0]);
  };
  while (i < s.length) {
    const ch = s[i];
    if ("([{".includes(ch)) {
      opening.push(ch);
      stack.push({});
      i++;
    } else if (")]}".includes(ch)) {
      const open = opening.pop();
      if (!open || "([{".indexOf(open) !== ")]}".indexOf(ch)) throw new Error("Klammern passen nicht zusammen.");
      i++;
      const n = readNum();
      const inner = stack.pop()!;
      const top = stack[stack.length - 1];
      for (const [el, c] of Object.entries(inner)) top[el] = (top[el] ?? 0) + c * n;
    } else if (/[A-Z]/.test(ch)) {
      const m = /^[A-Z][a-z]?/.exec(s.slice(i))!;
      let el = m[0];
      // "Co" vs. "C" + "O": Zweibuchstaben-Element nur, wenn es existiert
      if (el.length === 2 && !(el in ATOMIC_MASS)) el = el[0];
      if (!(el in ATOMIC_MASS)) throw new Error(`Unbekanntes Element „${el}“.`);
      i += el.length;
      const n = readNum();
      const top = stack[stack.length - 1];
      top[el] = (top[el] ?? 0) + n;
    } else {
      throw new Error(`Unerwartetes Zeichen „${ch}“. Elemente beginnen mit einem Grossbuchstaben (z. B. Cl, nicht cl).`);
    }
  }
  if (opening.length) throw new Error("Eine Klammer wird nicht geschlossen.");
  return stack[0];
}

export function molarMass(formula: string): FormulaResult {
  const counts = parseFormula(formula);
  const mass = Object.entries(counts).reduce((s, [el, n]) => s + ATOMIC_MASS[el] * n, 0);
  // Reihenfolge nach Hill: C, H, dann alphabetisch
  const order = Object.keys(counts).sort((a, b) => {
    const rank = (x: string) => (counts.C ? (x === "C" ? 0 : x === "H" ? 1 : 2) : 2);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return {
    mass,
    counts,
    parts: order.map((el) => ({
      element: el,
      count: counts[el],
      mass: ATOMIC_MASS[el] * counts[el],
      percent: ((ATOMIC_MASS[el] * counts[el]) / mass) * 100,
    })),
  };
}
