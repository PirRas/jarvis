// Wirkstoff-Steckbrief über PubChem PUG REST (kostenlos, erlaubt Abfragen direkt aus dem Browser).
// PubChem kennt vor allem englische Namen und INN; einige deutsche Namen werden vorher übersetzt.

const BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const PROPS = "MolecularFormula,MolecularWeight,IUPACName,SMILES,ConnectivitySMILES,XLogP,HBondDonorCount,HBondAcceptorCount,TPSA,RotatableBondCount";

export type Compound = {
  cid: number;
  query: string; // Name, unter dem PubChem den Stoff gefunden hat
  formula: string;
  mw: number;
  iupac: string;
  smiles: string;
  xlogp: number | null;
  hbd: number;
  hba: number;
  tpsa: number | null;
  rotb: number | null;
  synonyms: string[];
  image: string;
  url: string;
};

// Häufige deutsche Bezeichnungen, die PubChem nicht kennt
const GERMAN: Record<string, string> = {
  acetylsalicylsäure: "aspirin",
  ass: "aspirin",
  ascorbinsäure: "ascorbic acid",
  natriumchlorid: "sodium chloride",
  kochsalz: "sodium chloride",
  glukose: "glucose",
  traubenzucker: "glucose",
  harnstoff: "urea",
  essigsäure: "acetic acid",
  salzsäure: "hydrochloric acid",
  schwefelsäure: "sulfuric acid",
  natronlauge: "sodium hydroxide",
  natriumhydroxid: "sodium hydroxide",
  natriumhydrogencarbonat: "sodium bicarbonate",
  ethanol: "ethanol",
  alkohol: "ethanol",
  wasserstoffperoxid: "hydrogen peroxide",
  levothyroxin: "levothyroxine",
  colecalciferol: "cholecalciferol",
  "vitamin d3": "cholecalciferol",
  "vitamin c": "ascorbic acid",
};

/** Kandidaten für die Suche: Eingabe, Übersetzung, einfache Umformungen (…säure → …ic acid, Endung -e). */
export function candidates(name: string) {
  const n = name.trim();
  const low = n.toLowerCase();
  const out = [n];
  if (GERMAN[low]) out.push(GERMAN[low]);
  if (/säure$/.test(low)) out.push(low.replace(/säure$/, "ic acid"));
  const umlaut = low.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
  if (umlaut !== low) out.push(umlaut);
  if (/(in|ol|on|at|id)$/.test(low)) out.push(`${low}e`); // Levothyroxin → levothyroxine
  return [...new Set(out)];
}

async function getJson(url: string) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (res.status === 503) throw new Error("PubChem ist gerade überlastet. Bitte in ein paar Sekunden nochmals versuchen.");
  if (!res.ok) throw new Error(`PubChem antwortet mit Fehler ${res.status}.`);
  return res.json();
}

type PropRow = {
  CID: number;
  MolecularFormula?: string;
  MolecularWeight?: string | number;
  IUPACName?: string;
  SMILES?: string;
  ConnectivitySMILES?: string;
  XLogP?: number;
  HBondDonorCount?: number;
  HBondAcceptorCount?: number;
  TPSA?: number;
  RotatableBondCount?: number;
};

export async function lookupCompound(name: string): Promise<Compound | null> {
  if (!name.trim()) return null;
  for (const q of candidates(name)) {
    const data = await getJson(`${BASE}/compound/name/${encodeURIComponent(q)}/property/${PROPS}/JSON`);
    const p: PropRow | undefined = data?.PropertyTable?.Properties?.[0];
    if (!p) continue;
    const syn = await getJson(`${BASE}/compound/cid/${p.CID}/synonyms/JSON`).catch(() => null);
    // CAS- und Registriernummern ausblenden, gleiche Namen in anderer Schreibweise nur einmal
    const seen = new Set<string>();
    const synonyms = ((syn?.InformationList?.Information?.[0]?.Synonym ?? []) as string[])
      .filter((s) => /[a-z]{3}/i.test(s) && !/^[A-Z0-9-]{8,}$/.test(s) && !/[:]|\(\+-\)/.test(s) && s.length < 40)
      .filter((s) => !seen.has(s.toLowerCase()) && !!seen.add(s.toLowerCase()))
      .slice(0, 10);
    return {
      cid: p.CID,
      query: q,
      formula: p.MolecularFormula ?? "",
      mw: Number(p.MolecularWeight ?? 0),
      iupac: p.IUPACName ?? "",
      smiles: p.SMILES ?? p.ConnectivitySMILES ?? "",
      xlogp: typeof p.XLogP === "number" ? p.XLogP : null,
      hbd: p.HBondDonorCount ?? 0,
      hba: p.HBondAcceptorCount ?? 0,
      tpsa: typeof p.TPSA === "number" ? p.TPSA : null,
      rotb: typeof p.RotatableBondCount === "number" ? p.RotatableBondCount : null,
      synonyms,
      image: `${BASE}/compound/cid/${p.CID}/PNG?image_size=300x300`,
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}`,
    };
  }
  return null;
}

export type LipinskiRule = { label: string; value: string; ok: boolean };

/** Lipinskis Rule of Five: Hinweis auf orale Bioverfügbarkeit (höchstens ein Verstoss gilt als unauffällig). */
export function lipinski(c: Compound) {
  const rules: LipinskiRule[] = [
    { label: "Molmasse ≤ 500 g/mol", value: `${c.mw.toFixed(1)} g/mol`, ok: c.mw <= 500 },
    { label: "logP ≤ 5", value: c.xlogp === null ? "unbekannt" : String(c.xlogp), ok: c.xlogp === null || c.xlogp <= 5 },
    { label: "H-Brücken-Donoren ≤ 5", value: String(c.hbd), ok: c.hbd <= 5 },
    { label: "H-Brücken-Akzeptoren ≤ 10", value: String(c.hba), ok: c.hba <= 10 },
  ];
  const violations = rules.filter((r) => !r.ok).length;
  return { rules, violations, passes: violations <= 1 };
}

/** Veber-Regeln (wie im Skill medchem): Flexibilität und polare Oberfläche, ergänzt Lipinski. */
export function veber(c: Compound) {
  const rules: LipinskiRule[] = [
    { label: "Drehbare Bindungen ≤ 10", value: c.rotb === null ? "unbekannt" : String(c.rotb), ok: c.rotb === null || c.rotb <= 10 },
    { label: "Polare Oberfläche (TPSA) ≤ 140 Å²", value: c.tpsa === null ? "unbekannt" : `${c.tpsa} Å²`, ok: c.tpsa === null || c.tpsa <= 140 },
  ];
  // TPSA bis etwa 90 Å² gilt als Hinweis auf ZNS-Gängigkeit (Blut-Hirn-Schranke)
  return { rules, passes: rules.every((r) => r.ok), cns: c.tpsa === null ? null : c.tpsa <= 90 };
}

/** Links zu Schweizer Arzneimittel-Informationen. */
export function infoLinks(name: string) {
  const q = encodeURIComponent(name.trim());
  return [
    { label: "Compendium", url: `https://compendium.ch/search?q=${q}` },
    { label: "PharmaWiki", url: `https://www.pharmawiki.ch/wiki/index.php?wiki=${q}` },
    { label: "Swissmedicinfo (Fachinformation)", url: "https://www.swissmedicinfo.ch/" },
  ];
}
