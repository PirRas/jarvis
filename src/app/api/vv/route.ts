// Liest Termine und Räume einer Lehrveranstaltung aus dem Vorlesungsverzeichnis der Uni Basel.
// GET /api/vv?nr=10380     -> alle passenden Angebote (Vorlesung und Pharmazie-Übungsgruppen) samt Einzelterminen
// GET /api/vv?nr=10551-07  -> nur diese Gruppe
// Das Verzeichnis begrenzt die Anfragen (HTTP 429): Detailseiten werden deshalb nacheinander geladen,
// Angebote für andere Studiengänge übersprungen und Ergebnisse kurz zwischengespeichert.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://vorlesungsverzeichnis.unibas.ch/de/vorlesungsverzeichnis";
const MAX_OFFERS = 10;
const TTL_MS = 8 * 60_000; // Räume können sich kurzfristig ändern

export type VvSession = { date: string; start: string; end: string; room: string };
export type VvOffer = { id: string; number: string; title: string; url: string; sessions: VvSession[] };
type Result = { nr: string; checkedAt: number; offers: VvOffer[] };

// Zwischenspeicher pro Server-Instanz (überlebt mehrere Aufrufe kurz hintereinander)
const cache = new Map<string, Result>();
const pending = new Map<string, Promise<Result>>();

const ENTITIES: Record<string, string> = {
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">",
};

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, e: string) => ENTITIES[e] ?? m)
    .replace(/\s+/g, " ")
    .trim();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Alle Anfragen an das Verzeichnis laufen über eine Warteschlange mit Mindestabstand.
const GAP_MS = 400;
let lane: Promise<unknown> = Promise.resolve();
let lastAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = lane.catch(() => undefined).then(async () => {
    const wait = lastAt + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastAt = Date.now();
    }
  });
  lane = run;
  return run;
}

async function get(url: string, attempt = 0): Promise<string> {
  const res = await throttled(() => fetchPage(url));
  if (res.status === 429 && attempt < 3) {
    const retry = Number(res.headers.get("retry-after")) * 1000 || 2500 * 2 ** attempt;
    await sleep(Math.min(retry, 10_000));
    return get(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`Vorlesungsverzeichnis antwortet mit Fehler ${res.status}`);
  return res.text();
}

function fetchPage(url: string) {
  return fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Jarvis Uni-Cockpit)", "accept-language": "de" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
}

/** Treffer der Suche: ID, Nummer und Titel, ohne Detailseite. */
function parseSearch(html: string) {
  const out: { id: string; title: string }[] = [];
  for (const m of html.matchAll(/href="\?id=(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (!out.some((o) => o.id === m[1])) out.push({ id: m[1], title: decode(m[2]) });
  }
  return out;
}

/** Angebote für andere Studiengänge, z. B. "(Biologie)", sind für die Pharmazie nicht relevant. */
function relevant(title: string) {
  const program = /\(([^)]+)\)\s*$/.exec(title)?.[1];
  return !program || /pharma/i.test(program);
}

function parseDetail(id: string, html: string): VvOffer {
  const text = decode(html);
  const head =
    /(\d{5}-\d{2})\s*-\s*(.+?)\s*\(\d+(?:[.,]\d+)?\s*KP\)/.exec(text) ?? /(\d{5}-\d{2})\s*-\s*(.{5,160}?)\s+\d{5}-\d{2} im/.exec(text);
  const sessions: VvSession[] = [];
  const start = html.indexOf("Einzeltermine");
  if (start !== -1) {
    const row = /<tr>\s*<td[^>]*>\s*([^<]*?\d{2}\.\d{2}\.\d{4})\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
    for (const m of html.slice(start).matchAll(row)) {
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
  return { id, number: head?.[1] ?? "", title: head?.[2]?.trim() ?? "", url: `${BASE}?id=${id}`, sessions };
}

async function lookup(nr: string): Promise<Result> {
  const [base, group] = nr.split("-");
  const hits = parseSearch(await get(`${BASE}?vv=${encodeURIComponent(base)}&search=1`)).filter((h) => relevant(h.title));
  const offers: VvOffer[] = [];
  for (const h of hits.slice(0, MAX_OFFERS)) {
    const offer = parseDetail(h.id, await get(`${BASE}?id=${h.id}`));
    if (!offer.number.startsWith(base)) continue;
    if (group && offer.number !== `${base}-${group}`) continue;
    offers.push(offer);
    if (group) break;
  }
  return { nr, checkedAt: Date.now(), offers };
}

export async function GET(req: Request) {
  const nr = new URL(req.url).searchParams.get("nr")?.trim() ?? "";
  if (!/^\d{4,6}(-\d{2})?$/.test(nr)) {
    return Response.json({ error: "Bitte eine Veranstaltungsnummer wie 10380 oder 10551-07 angeben." }, { status: 400 });
  }
  const hit = cache.get(nr);
  if (hit && Date.now() - hit.checkedAt < TTL_MS) return Response.json(hit, { headers: { "cache-control": "no-store" } });

  try {
    let job = pending.get(nr);
    if (!job) {
      job = lookup(nr).finally(() => pending.delete(nr));
      pending.set(nr, job);
    }
    const result = await job;
    cache.set(nr, result);
    return Response.json(result, { headers: { "cache-control": "public, max-age=0, s-maxage=480, stale-while-revalidate=120" } });
  } catch (e) {
    if (hit) return Response.json({ ...hit, stale: true }, { headers: { "cache-control": "no-store" } });
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
