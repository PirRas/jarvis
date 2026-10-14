"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NewsFeed } from "@/lib/assistant";
import { deleteItems, putItem } from "@/lib/db";
import {
  displayUrl,
  dropCache,
  fetchNews,
  readCache,
  readIds,
  saveReadIds,
  UNIBAS_NEWS_URL,
  withCredentials,
  type NewsCache,
} from "@/lib/news";
import { fmtShortDay, fmtTime, HOUR } from "@/lib/planner";

const STALE = HOUR;

export function NewsView({ feeds }: { feeds: NewsFeed[] }) {
  const [caches, setCaches] = useState<Record<string, NewsCache>>({});
  const [read, setRead] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const refresh = useCallback(
    async (force: boolean) => {
      setBusy(true);
      const next: Record<string, NewsCache> = {};
      await Promise.all(
        feeds.map(async (f) => {
          const c = readCache(f.id);
          next[f.id] = c && !force && Date.now() - c.fetchedAt < STALE && !c.error ? c : await fetchNews(f);
        }),
      );
      setCaches(next);
      setBusy(false);
    },
    [feeds],
  );

  useEffect(() => {
    setRead(readIds());
    const cached: Record<string, NewsCache> = {};
    for (const f of feeds) {
      const c = readCache(f.id);
      if (c) cached[f.id] = c;
    }
    setCaches(cached);
    refresh(false);
  }, [feeds, refresh]);

  const items = useMemo(
    () =>
      feeds
        .flatMap((f) => caches[f.id]?.items ?? [])
        .sort((a, b) => (b.date ?? 0) - (a.date ?? 0))
        .slice(0, 80),
    [feeds, caches],
  );
  const unread = items.filter((i) => !read.has(i.id)).length;
  const shown = onlyUnread ? items.filter((i) => !read.has(i.id)) : items;

  function markRead(ids: string[]) {
    const next = new Set(read);
    for (const id of ids) next.add(id);
    setRead(next);
    saveReadIds(next);
  }

  return (
    <div className="st-news">
      <section className="sheet panel">
        <div className="row spread">
          <h2 className="panel-title">
            Neuigkeiten{unread > 0 && <span className="pill st-pill-open">{unread} neu</span>}
          </h2>
          <div className="row">
            <label className="check small">
              <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
              nur ungelesene
            </label>
            {unread > 0 && (
              <button className="btn btn-quiet" onClick={() => markRead(items.map((i) => i.id))}>
                Alle gelesen
              </button>
            )}
            <button className="btn btn-quiet" onClick={() => refresh(true)} disabled={busy || !feeds.length}>
              {busy ? "Lade …" : "Aktualisieren"}
            </button>
          </div>
        </div>
        {!feeds.length && <p className="muted small">Noch keine News-Abos. Füge unten ADAM oder die Uni-News hinzu.</p>}
        {feeds.map((f) => {
          const c = caches[f.id];
          return c?.error ? (
            <p key={f.id} className="error small">
              {f.name}: {c.error}
            </p>
          ) : null;
        })}
        {shown.length > 0 && (
          <ul className="st-news-list">
            {shown.map((i) => (
              <li key={i.id} className={read.has(i.id) ? "is-read" : ""}>
                <a href={i.link || undefined} target="_blank" rel="noreferrer" onClick={() => markRead([i.id])} className="st-news-title">
                  {i.title}
                </a>
                <div className="small muted">
                  {i.source}
                  {i.date && ` · ${fmtShortDay(i.date)}, ${fmtTime(i.date)}`}
                </div>
                {i.summary && <p className="small st-news-summary">{i.summary}</p>}
              </li>
            ))}
          </ul>
        )}
        {feeds.length > 0 && items.length === 0 && !busy && <p className="muted small">Keine Einträge.</p>}
      </section>

      <FeedManager feeds={feeds} caches={caches} />
    </div>
  );
}

function FeedManager({ feeds, caches }: { feeds: NewsFeed[]; caches: Record<string, NewsCache> }) {
  const [name, setName] = useState("ADAM");
  const [url, setUrl] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(feedUrl = url, feedName = name, u = user, p = password) {
    setError(null);
    let full: string;
    try {
      full = withCredentials(feedUrl, u.trim(), p);
      if (!/^https:\/\//i.test(full)) throw new Error();
    } catch {
      setError("Bitte eine vollständige https-Adresse eingeben.");
      return;
    }
    setBusy(true);
    const feed: NewsFeed = { id: crypto.randomUUID(), name: feedName.trim() || "News", url: full, createdAt: Date.now() };
    const c = await fetchNews(feed);
    setBusy(false);
    if (c.error) {
      dropCache(feed.id);
      setError(c.error);
      return;
    }
    await putItem("news", feed);
    setUrl("");
    setPassword("");
  }

  const hasUnibas = feeds.some((f) => f.url === UNIBAS_NEWS_URL);

  return (
    <section className="sheet panel">
      <h2 className="panel-title">News-Abos</h2>

      {feeds.length > 0 && (
        <ul className="feed-list">
          {feeds.map((f) => {
            const c = caches[f.id];
            return (
              <li key={f.id} className="feed">
                <div style={{ minWidth: 0 }}>
                  <strong>{f.name}</strong>
                  <div className="small muted st-url">{displayUrl(f.url)}</div>
                  <div className="small muted">
                    {c?.fetchedAt ? `${c.items.length} Einträge · geladen ${fmtTime(c.fetchedAt)}` : "noch nicht geladen"}
                  </div>
                </div>
                <button
                  className="btn btn-quiet"
                  onClick={async () => {
                    if (!confirm(`Abo „${f.name}“ entfernen?`)) return;
                    dropCache(f.id);
                    await deleteItems("news", [f.id]);
                  }}
                >
                  Entfernen
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!hasUnibas && (
        <p className="small">
          <button className="btn btn-quiet" onClick={() => add(UNIBAS_NEWS_URL, "Uni Basel News", "", "")} disabled={busy}>
            + News der Uni Basel abonnieren
          </button>
        </p>
      )}

      <details className="st-help">
        <summary>So bekommst du die Neuigkeiten aus ADAM</summary>
        <p className="small">
          ADAM (ILIAS) bietet einen <strong>privaten Neuigkeiten-Feed</strong> an. Er ist mit deinem Benutzernamen und einem
          eigenen <strong>Feed-Passwort</strong> geschützt (nicht dein Uni-Passwort).
        </p>
        <ol className="small">
          <li>In ADAM auf dem Dashboard den Block bzw. die Seite „Neuigkeiten“ öffnen.</li>
          <li>
            Dort im Aktionen-Menü die Einstellungen öffnen, den privaten RSS-Feed aktivieren und ein Feed-Passwort festlegen.
          </li>
          <li>Die angezeigte Feed-Adresse kopieren (sie enthält „privfeed.php“).</li>
          <li>Hier Adresse, deinen ADAM-Benutzernamen und das Feed-Passwort eintragen.</li>
        </ol>
        <p className="small muted">
          Die Menübezeichnungen können je nach ADAM-Version leicht abweichen. Belegt ist, dass ADAM unter
          adam.unibas.ch/privfeed.php einen passwortgeschützten Newsfeed bereitstellt.
        </p>
      </details>

      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field span-2">
          <span>Feed-Adresse (RSS oder Atom)</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://adam.unibas.ch/privfeed.php?…"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>Benutzername (falls nötig)</span>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span>Feed-Passwort (falls nötig)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => add()} disabled={busy || !url.trim()}>
          {busy ? "Prüfe …" : "Abonnieren"}
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
      <p className="small muted">
        Die Adresse (mit Feed-Passwort) wird wie deine übrigen Daten in deinem Konto gespeichert und zwischen deinen Geräten
        abgeglichen. Verwende nie dein Uni-Passwort als Feed-Passwort.
      </p>
    </section>
  );
}
