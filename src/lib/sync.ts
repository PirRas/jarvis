"use client";

import { applyRemote, localChangesSince, onLocalChange, SYNC_STORES, type SyncStore } from "./db";
import { supabase } from "./supabase";

// Abgleich zwischen Geräten: Jedes Gerät lädt seine Änderungen hoch und holt die der anderen ab.
// Bei Konflikten gewinnt die jüngere Änderung (die Regel steckt zusätzlich im Datenbank-Trigger).

export type SyncStatus =
  | { state: "off" }
  | { state: "idle"; lastSync: number | null }
  | { state: "syncing" }
  | { state: "error"; message: string; lastSync: number | null };

const BATCH = 200;
const PAGE = 1000;
const OVERLAP_MS = 5000; // beim Abrufen etwas zurückgreifen, falls Schreibvorgänge sich überschneiden

let status: SyncStatus = { state: "off" };
const statusListeners = new Set<(s: SyncStatus) => void>();

function setStatus(s: SyncStatus) {
  status = s;
  for (const fn of statusListeners) fn(s);
}

export function getSyncStatus() {
  return status;
}

export function onSyncStatus(fn: (s: SyncStatus) => void) {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

/** Seiten lauschen hierauf, um nach dem Abruf neuer Daten neu zu laden. */
export const REMOTE_CHANGE_EVENT = "sync:remote-change";

// Fortschritt pro Konto, damit ein Kontowechsel sauber neu beginnt.
const key = (userId: string, name: string) => `sync:${userId}:${name}`;
function readNum(k: string) {
  try {
    return Number(localStorage.getItem(k) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function writeNum(k: string, v: number) {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    // ohne Speicher wird beim nächsten Mal alles erneut abgeglichen; das ist nur langsamer
  }
}

let running: Promise<void> | null = null;
let again = false;

/** Führt einen Abgleich aus. Mehrfache Aufrufe während eines laufenden Abgleichs werden zusammengefasst. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  const sb = supabase();
  if (!sb) return setStatus({ state: "off" });
  const { data: auth } = await sb.auth.getSession();
  const user = auth.session?.user;
  if (!user) return setStatus({ state: "off" });
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return setStatus({ state: "error", message: "Offline. Der Abgleich läuft, sobald wieder Netz da ist.", lastSync: readNum(key(user.id, "lastSync")) || null });
  }

  setStatus({ state: "syncing" });
  try {
    // 1. Hochladen
    const pushedKey = key(user.id, "pushedUntil");
    const scanStart = Date.now();
    const changes = await localChangesSince(readNum(pushedKey));
    for (let i = 0; i < changes.length; i += BATCH) {
      const rows = changes.slice(i, i + BATCH).map((c) => ({
        user_id: user.id,
        store: c.store,
        id: c.id,
        data: c.data,
        deleted: c.data === null,
        client_updated_at: c.updatedAt,
      }));
      const { error } = await sb.from("sync_items").upsert(rows, { onConflict: "user_id,store,id" });
      if (error) throw error;
    }
    writeNum(pushedKey, scanStart - 1);

    // 2. Abrufen
    // Versioniert: Ältere App-Stände haben Einträge neuer Bereiche (Stundenplan, Termine …) übersprungen;
    // mit neuem Cursor wird einmal alles erneut gelesen.
    const cursorKey = key(user.id, "pulledUntil:v3");
    let cursor = readNum(cursorKey);
    let from = Math.max(0, cursor - OVERLAP_MS);
    let anyChange = false;
    for (;;) {
      // Ein Upload-Paket teilt sich denselben Zeitstempel; mit gte wird eine an der Seitengrenze
      // geteilte Gruppe vollständig erneut gelesen (doppelt anwenden schadet nicht).
      const { data, error } = await sb
        .from("sync_items")
        .select("store,id,data,deleted,client_updated_at,synced_at")
        .gte("synced_at", new Date(from).toISOString())
        .order("synced_at", { ascending: true })
        .range(0, PAGE - 1);
      if (error) throw error;
      for (const row of data) {
        if (!SYNC_STORES.includes(row.store as SyncStore)) continue;
        const changed = await applyRemote(
          row.store as SyncStore,
          row.id,
          row.deleted ? null : row.data,
          Number(row.client_updated_at),
        );
        anyChange ||= changed;
      }
      const last = data.at(-1);
      if (!last) break;
      const lastTime = new Date(last.synced_at).getTime();
      cursor = Math.max(cursor, lastTime);
      // Nur weiterblättern, wenn die Seite voll war und der Cursor tatsächlich vorankommt.
      if (data.length < PAGE || lastTime <= from) break;
      from = lastTime;
    }
    writeNum(cursorKey, cursor);

    if (anyChange) window.dispatchEvent(new Event(REMOTE_CHANGE_EVENT));
    const now = Date.now();
    writeNum(key(user.id, "lastSync"), now);
    setStatus({ state: "idle", lastSync: now });
  } catch (err) {
    const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
    setStatus({ state: "error", message: `Abgleich fehlgeschlagen: ${message}`, lastSync: readNum(key(user.id, "lastSync")) || null });
  }
}

let started = false;

/** Startet den automatischen Abgleich: beim Start, nach Änderungen, beim Zurückkehren zur App und regelmäßig. */
export function startAutoSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  const sb = supabase();
  if (!sb) return;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const soon = (ms = 3000) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => syncNow(), ms);
  };

  onLocalChange(() => soon());
  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") soon(200);
    if (event === "SIGNED_OUT") setStatus({ state: "off" });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") soon(500);
    else syncNow(); // Änderungen sichern, bevor das Handy die App pausiert
  });
  window.addEventListener("online", () => soon(500));
  setInterval(() => document.visibilityState === "visible" && syncNow(), 2 * 60 * 1000);
}
