// Liest Termine und Räume einer Lehrveranstaltung aus dem Vorlesungsverzeichnis der Uni Basel.
// GET /api/vv?nr=10380  ->  alle Angebote mit dieser Nummer (z. B. Vorlesung und Übungsgruppen) samt Einzelterminen.
// Räume können sich kurzfristig ändern, darum nur kurz zwischenspeichern.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://vorlesungsverzeichnis.unibas.ch/de/vorlesungsverzeichnis";
const MAX_OFFERS = 14;

export type VvSession = { date: string; start: string; end: string; room: string };
export type VvOffer = { id: string; number: string; title: string; url: string; sessions: VvSession[] };

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(auml|ouml|uuml|Auml|Ouml|Uuml|szlig|amp|nbsp|quot|apos|lt|gt);/g, (_, e) =>
      ({ auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">" })[e as string] ?? "",
    )
    .replace(/\s+/g, " ")
    .trim();

async function get(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Jarvis Uni-Cockpit)", "accept-language": "de" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Vorlesungsverzeichnis antwortet mit Fehler ${res.status}`);
  return res.text();
}

function parseDetail(id: string, html: string): VvOffer {
  const text = decode(html);
  const head = /(\d{5}-\d{2})\s*-\s*(.+?)\s*\(\d+(?:[.,]\d+)?\s*KP\)/.exec(text) ?? /(\d{5}-\d{2})\s*-\s*(.{5,120}?)\s+\d{5}-\d{2} im/.exec(text);
  const sessions: VvSession[] = [];
  const start = html.indexOf("Einzeltermine");
  if (start !== -1) {
    const part = html.slice(start);
    const row = /<tr>\s*<td[^>]*>\s*([^<]*?\d{2}\.\d{2}\.\d{4})\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
    for (const m of part.matchAll(row)) {
      const d = /(\d{2})\.(\d{2})\.(\d{4})/.exec(m[1]);
      const t = /(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/.exec(decode(m[2]));
      if (!d) continue;
      sessions.push({
        date: `${d[3]}-${d[2]}-${d[1]}`,
        start: t ? `${t[1].padStart(2, "0")}:${t[2]}` : "",
        end: t ? `${t[3].padStart(2, "0")}:${t[4]}` : "",
        room: decode(m[3]),
      });
    }
  }
  return {
    id,
    number: head?.[1] ?? "",
    title: head?.[2]?.trim() ?? "",
    url: `${BASE}?id=${id}`,
    sessions,
  };
}

export async function GET(req: Request) {
  const nr = new URL(req.url).searchParams.get("nr")?.trim() ?? "";
  if (!/^\d{4,6}(-\d{2})?$/.test(nr)) {
    return Response.json({ error: "Bitte eine Veranstaltungsnummer wie 10380 angeben." }, { status: 400 });
  }
  try {
    const search = await get(`${BASE}?vv=${encodeURIComponent(nr)}&search=1`);
    const ids = [...new Set([...search.matchAll(/href="\?id=(\d+)"/g)].map((m) => m[1]))].slice(0, MAX_OFFERS);
    const offers = await Promise.all(ids.map(async (id) => parseDetail(id, await get(`${BASE}?id=${id}`))));
    const base = nr.split("-")[0];
    return Response.json(
      { nr, checkedAt: Date.now(), offers: offers.filter((o) => !o.number || o.number.startsWith(base)) },
      { headers: { "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=300" } },
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
