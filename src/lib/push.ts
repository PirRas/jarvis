"use client";

// Push-Benachrichtigungen im Browser: Gerät anmelden und den Erinnerungsplan in Supabase aktuell halten.
// Verschickt wird serverseitig (/api/push/tick), damit Erinnerungen auch bei geschlossener App ankommen.
// In der Android-App gibt es kein Web Push: dort plant das Handy dieselben Erinnerungen lokal (native.ts).

import type { Mark, Todo } from "./assistant";
import { putItems } from "./db";
import { appDisableNotify, appEnableNotify, appNotifyState, appScheduleReminders, appTestNotify, isNativeApp } from "./native";
import type { Occurrence, PlannerData } from "./planner";
import { buildReminders, enabledKinds, PUSH_ENABLED_MARK } from "./reminders";
import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState =
  | "unsupported" // Browser kann kein Push (z. B. iPhone ohne Startbildschirm-App)
  | "unconfigured" // Schlüssel fehlen noch in Vercel
  | "signed-out" // ohne Konto kein Versand möglich
  | "denied" // im Browser blockiert
  | "off"
  | "on";

function supported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js");
}

export async function pushState(): Promise<PushState> {
  if (isNativeApp()) return appNotifyState().catch(() => "unsupported" as const);
  if (!supported()) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "unconfigured";
  const sb = supabase();
  if (!sb || !(await sb.auth.getSession()).data.session) return "signed-out";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function keyBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceName() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : "Gerät";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} auf ${os}`;
}

async function saveSubscription(sb: NonNullable<ReturnType<typeof supabase>>, sub: PushSubscription, userId: string) {
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await sb.from("push_subscriptions").upsert({
    endpoint: json.endpoint,
    user_id: userId,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    device: deviceName(),
  });
  return error;
}

let refreshed = false;

/**
 * Einmal pro App-Start das Abo dieses Geräts erneut hinterlegen. Der Browser kann es erneuern, und der Server
 * löscht Abos, die nicht mehr angenommen werden; sonst bliebe das Gerät stumm, obwohl Push als "an" gilt.
 */
async function refreshSubscription(sb: NonNullable<ReturnType<typeof supabase>>, userId: string) {
  if (refreshed || !supported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  if (!(await saveSubscription(sb, sub, userId))) refreshed = true;
}

/** Fragt die Erlaubnis an, meldet dieses Gerät an und speichert das Abo in Supabase. */
export async function enablePush() {
  if (isNativeApp()) return appEnableNotify();
  const sb = supabase();
  if (!sb) throw new Error("Abgleich ist nicht eingerichtet.");
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error("Bitte zuerst unter «Konto» anmelden.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Benachrichtigungen wurden im Browser nicht erlaubt.");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const error = await saveSubscription(sb, sub, data.session.user.id);
  if (error) throw new Error(`Abo konnte nicht gespeichert werden: ${error.message}`);
  // Merkt sich (auf allen Geräten), dass Push genutzt wird; erst dann wird ein Erinnerungsplan geschrieben.
  await putItems("marks", [{ id: PUSH_ENABLED_MARK, createdAt: Date.now() }]);
  lastHash = "";
}

/** Meldet dieses Gerät ab. Die anderen Geräte bekommen weiterhin Nachrichten. */
export async function disablePush() {
  if (isNativeApp()) return appDisableNotify();
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase()?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

/** Schickt sofort eine Testnachricht an alle angemeldeten Geräte. */
export async function sendTestPush() {
  if (isNativeApp()) {
    await appTestNotify();
    return { sent: 1, devices: 1 };
  }
  const session = (await supabase()?.auth.getSession())?.data.session;
  if (!session) throw new Error("Nicht angemeldet.");
  const res = await fetch("/api/push/test", { method: "POST", headers: { authorization: `Bearer ${session.access_token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Fehler ${res.status}`);
  return body as { sent: number; devices: number };
}

// ---------- Erinnerungsplan abgleichen ----------

let lastHash = "";
let timer: ReturnType<typeof setTimeout> | null = null;
let nativeTimer: ReturnType<typeof setTimeout> | null = null;

/** Nach Änderungen (gebündelt) den Erinnerungsplan in Supabase aktualisieren. */
export function scheduleReminderSync(data: PlannerData, todos: Todo[], marks: Mark[], prep: Occurrence[] = []) {
  if (isNativeApp()) {
    if (nativeTimer) clearTimeout(nativeTimer);
    nativeTimer = setTimeout(() => {
      appScheduleReminders(buildReminders(data, todos, enabledKinds(marks), Date.now(), prep)).catch(() => {});
    }, 2000);
    return;
  }
  if (!marks.some((m) => m.id === PUSH_ENABLED_MARK) || !VAPID_PUBLIC_KEY) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    syncReminders(data, todos, marks, prep).catch(() => {
      // Netz weg oder Tabellen fehlen: beim nächsten Mal erneut versuchen
      lastHash = "";
    });
  }, 4000);
}

async function syncReminders(data: PlannerData, todos: Todo[], marks: Mark[], prep: Occurrence[]) {
  const sb = supabase();
  const session = (await sb?.auth.getSession())?.data.session;
  if (!sb || !session) return;
  await refreshSubscription(sb, session.user.id);
  const now = Date.now();
  const reminders = buildReminders(data, todos, enabledKinds(marks), now, prep);
  // Stundengenau vergleichen, damit nicht jedes Neuladen schreibt
  const hash = JSON.stringify([Math.floor(now / 3_600_000), reminders.map((r) => [r.key, r.dueAt, r.title, r.body])]);
  if (hash === lastHash) return;

  const userId = session.user.id;
  const rows = reminders.map((r) => ({
    user_id: userId,
    key: r.key,
    due_at: new Date(r.dueAt).toISOString(),
    title: r.title,
    body: r.body,
    url: r.url,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("push_schedule").upsert(rows.slice(i, i + 200), { onConflict: "user_id,key" });
    if (error) throw error;
  }
  // Künftige, noch nicht verschickte Einträge entfernen, die es nicht mehr gibt (z. B. Aufgabe erledigt)
  const { data: existing, error } = await sb
    .from("push_schedule")
    .select("key")
    .is("sent_at", null)
    .gt("due_at", new Date(now).toISOString());
  if (error) throw error;
  const keep = new Set(rows.map((r) => r.key));
  const stale = (existing ?? []).map((r) => r.key as string).filter((k) => !keep.has(k));
  for (let i = 0; i < stale.length; i += 100) {
    await sb.from("push_schedule").delete().in("key", stale.slice(i, i + 100));
  }
  lastHash = hash;
}
