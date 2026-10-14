"use client";

// News-Abos (RSS 2.0, RSS 1.0/RDF, Atom): Abruf über /api/rss, Auswertung im Browser.
// Der Stand "gelesen" und der letzte Abruf liegen nur auf diesem Gerät (localStorage).

import type { NewsFeed } from "./assistant";

export type NewsItem = {
  id: string; // feedId|guid
  feedId: string;
  source: string;
  title: string;
  link: string;
  date: number | null;
  summary: string;
};

export type NewsCache = { fetchedAt: number; error: string | null; items: NewsItem[] };

const CACHE_KEY = (id: string) => `news:${id}`;
const READ_KEY = "news-read";
const MAX_READ = 800;

const text = (el: Element | null | undefined) => el?.textContent?.trim() ?? "";

/** Nimmt nur den Text aus HTML-Zusammenfassungen und kürzt ihn. */
function plain(html: string, max = 240) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const t = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function parseDate(s: string) {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** RSS 2.0, RSS 1.0 (RDF) und Atom in eine einheitliche Liste umwandeln. */
export function parseFeed(xml: string, feed: Pick<NewsFeed, "id" | "name">): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Der Feed ist beschädigt und lässt sich nicht lesen.");
  const out: NewsItem[] = [];

  const entries = Array.from(doc.getElementsByTagName("entry")); // Atom
  if (entries.length) {
    for (const e of entries) {
      const linkEl =
        Array.from(e.getElementsByTagName("link")).find((l) => (l.getAttribute("rel") ?? "alternate") === "alternate") ??
        e.getElementsByTagName("link")[0];
      const link = linkEl?.getAttribute("href") ?? "";
      const guid = text(e.getElementsByTagName("id")[0]) || link;
      out.push({
        id: `${feed.id}|${guid}`,
        feedId: feed.id,
        source: feed.name,
        title: plain(text(e.getElementsByTagName("title")[0]), 200) || "(ohne Titel)",
        link,
        date: parseDate(text(e.getElementsByTagName("updated")[0]) || text(e.getElementsByTagName("published")[0])),
        summary: plain(text(e.getElementsByTagName("summary")[0]) || text(e.getElementsByTagName("content")[0])),
      });
    }
    return out;
  }

  for (const it of Array.from(doc.getElementsByTagName("item"))) {
    // RSS 2.0 und RDF
    const link = text(it.getElementsByTagName("link")[0]) || it.getAttribute("rdf:about") || "";
    const guid = text(it.getElementsByTagName("guid")[0]) || link || text(it.getElementsByTagName("title")[0]);
    const date = text(it.getElementsByTagName("pubDate")[0]) || text(it.getElementsByTagNameNS("*", "date")[0]);
    out.push({
      id: `${feed.id}|${guid}`,
      feedId: feed.id,
      source: feed.name,
      title: plain(text(it.getElementsByTagName("title")[0]), 200) || "(ohne Titel)",
      link,
      date: parseDate(date),
      summary: plain(text(it.getElementsByTagName("description")[0])),
    });
  }
  return out;
}

export function readCache(id: string): NewsCache | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY(id)) ?? "null");
  } catch {
    return null;
  }
}

function writeCache(id: string, cache: NewsCache) {
  try {
    localStorage.setItem(CACHE_KEY(id), JSON.stringify(cache));
  } catch {
    // ohne Speicher wird beim nächsten Öffnen neu geladen
  }
}

export function dropCache(id: string) {
  try {
    localStorage.removeItem(CACHE_KEY(id));
  } catch {
    // nichts zu tun
  }
}

/** Lädt einen Feed über den Server-Teil und merkt sich das Ergebnis. Fehler werden im Cache vermerkt. */
export async function fetchNews(feed: NewsFeed): Promise<NewsCache> {
  const prev = readCache(feed.id);
  try {
    const res = await fetch("/api/rss", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: feed.url }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `Fehler ${res.status}` }));
      throw new Error(error);
    }
    const items = parseFeed(await res.text(), feed).slice(0, 60);
    const cache = { fetchedAt: Date.now(), error: null, items };
    writeCache(feed.id, cache);
    return cache;
  } catch (e) {
    const cache = { fetchedAt: prev?.fetchedAt ?? 0, error: e instanceof Error ? e.message : String(e), items: prev?.items ?? [] };
    writeCache(feed.id, cache);
    return cache;
  }
}

export function readIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-MAX_READ)));
  } catch {
    // gilt dann nur für diese Sitzung
  }
}

/** Adresse mit Benutzername und Feed-Passwort zusammensetzen (Basic-Auth, z. B. für ADAM). */
export function withCredentials(url: string, user: string, password: string) {
  if (!user && !password) return url.trim();
  const u = new URL(url.trim());
  u.username = encodeURIComponent(user);
  u.password = encodeURIComponent(password);
  return u.toString();
}

/** Adresse ohne Passwort, zum Anzeigen. */
export function displayUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "•••";
    return u.toString();
  } catch {
    return url;
  }
}

export const UNIBAS_NEWS_URL = "https://www.unibas.ch/newsFeeds?category=&month=&year=&query=&path=/de/Aktuell/News";
