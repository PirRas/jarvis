// Literatursuche über Europe PMC (wie im Skill paper-lookup): kostenlos, ohne Schlüssel, erlaubt Abfragen aus dem Browser.
// Enthält PubMed/MEDLINE plus Open-Access-Volltexte aus PMC.

const BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

export type Paper = {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  pmid: string;
  pmcid: string;
  type: string;
  openAccess: boolean;
  citedBy: number;
  url: string;
};

export type PaperFilter = { reviews: boolean; openAccess: boolean; sort: "relevance" | "cited" | "date" };

type Row = {
  id: string;
  source: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  pubYear?: string;
  journalVolume?: string;
  issue?: string;
  pageInfo?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  pubType?: string;
  isOpenAccess?: string;
  citedByCount?: number;
};

/** Europe PMC liefert Titel mit maskiertem HTML (&lt;i&gt;…): als reinen Text zeigen. */
export function plain(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function buildQuery(q: string, f: PaperFilter) {
  // Nur Titel und Abstract: im Volltext erwähnen viele hochzitierte, fachfremde Paper den Begriff nebenbei
  const t = q.trim();
  let query = `(TITLE:(${t}) OR ABSTRACT:(${t}))`;
  if (f.reviews) query += ' AND PUB_TYPE:"review"';
  if (f.openAccess) query += " AND OPEN_ACCESS:y";
  if (f.sort === "cited") query += " sort_cited:y";
  if (f.sort === "date") query += " sort_date:y";
  return query;
}

export async function searchPapers(q: string, f: PaperFilter): Promise<{ total: number; papers: Paper[] }> {
  const url = `${BASE}?format=json&resultType=lite&pageSize=20&query=${encodeURIComponent(buildQuery(q, f))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Europe PMC antwortet mit Fehler ${res.status}.`);
  const data = await res.json();
  const rows: Row[] = data?.resultList?.result ?? [];
  return {
    total: data?.hitCount ?? 0,
    papers: rows.map((r) => ({
      id: `${r.source}-${r.id}`,
      title: plain(r.title ?? "").replace(/\.$/, ""),
      authors: (r.authorString ?? "").replace(/\.$/, ""),
      journal: r.journalTitle ?? "",
      year: r.pubYear ?? "",
      volume: r.journalVolume ?? "",
      issue: r.issue ?? "",
      pages: r.pageInfo ?? "",
      doi: r.doi ?? "",
      pmid: r.pmid ?? "",
      pmcid: r.pmcid ?? "",
      type: r.pubType ?? "",
      openAccess: r.isOpenAccess === "Y",
      citedBy: r.citedByCount ?? 0,
      url: r.pmcid
        ? `https://europepmc.org/article/PMC/${r.pmcid}`
        : `https://europepmc.org/article/${r.source}/${r.id}`,
    })),
  };
}

/** Zitat im Vancouver-Stil (in Medizin und Pharmazie üblich). */
export function vancouver(p: Paper) {
  // Mehr als 6 Autoren: die ersten 6, dann "et al."
  const names = p.authors.split(", ").filter(Boolean);
  const authors = names.length > 6 ? `${names.slice(0, 6).join(", ")}, et al` : names.join(", ");
  const loc = [p.volume && `${p.volume}${p.issue ? `(${p.issue})` : ""}`, p.pages].filter(Boolean).join(":");
  return `${authors ? `${authors}. ` : ""}${p.title}. ${p.journal ? `${p.journal}. ` : ""}${p.year}${loc ? `;${loc}` : ""}.${p.doi ? ` doi:${p.doi}` : ""}`;
}
