// Brücke zur Android-App (Capacitor, siehe ANDROID.md). In der App laufen Sprache, Erinnerungen und Teilen
// über native Funktionen, weil die Android-WebView Web Speech, Web Push und Downloads nicht kann.
// Auf der Website ist isNativeApp() false; die Plugins werden dort nie geladen (nur dynamische Importe).

import type { Reminder } from "./reminders";

type CapGlobal = { isNativePlatform?: () => boolean };

/** Läuft Jarvis gerade in der Android-App? (Die App spritzt window.Capacitor ein.) */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return (window as unknown as { Capacitor?: CapGlobal }).Capacitor?.isNativePlatform?.() === true;
}

/** Nur interne Pfade wie "/lernplan#x" zulassen, nie fremde Adressen (Benachrichtigungen tragen die Ziel-URL mit). */
export function safeAppPath(url: unknown): string {
  return typeof url === "string" && /^\/(?![/\\])/.test(url) && !/[\s\\]/.test(url) ? url : "/";
}

// ---------- Spracherkennung ----------

const LISTEN_ERRORS: Record<string, string> = {
  "Insufficient permissions": "Mikrofon nicht erlaubt. Erlaube den Zugriff in den App-Einstellungen von Jarvis.",
  "Audio recording error": "Kein Mikrofon gefunden.",
  "Network error": "Die Spracherkennung braucht eine Internetverbindung.",
  "Network timeout": "Die Spracherkennung braucht eine Internetverbindung.",
  "RecognitionService busy": "Die Spracherkennung ist gerade beschäftigt. Versuch es gleich nochmal.",
};

/**
 * Hört einmal zu (Android-Spracherkennung). Ohne Zwischenstände: Im Modus mit Zwischenständen meldet das Plugin
 * Stille und Fehler nicht zuverlässig, und Jarvis bliebe im Zustand "Hört zu" hängen.
 */
export function appListen(): { result: Promise<string>; stop(): void } {
  let stopped = false;
  const plugin = import("@capacitor-community/speech-recognition").then((m) => m.SpeechRecognition);
  const result = (async () => {
    const sr = await plugin;
    if (!(await sr.available()).available) throw new Error("Auf diesem Handy ist keine Spracherkennung verfügbar.");
    let perm = await sr.checkPermissions();
    if (perm.speechRecognition !== "granted") perm = await sr.requestPermissions();
    if (perm.speechRecognition !== "granted") throw new Error(LISTEN_ERRORS["Insufficient permissions"]);
    if (stopped) return "";
    try {
      const r = await sr.start({ language: "de-CH", maxResults: 1, partialResults: false, popup: false });
      return (r.matches?.[0] ?? "").trim();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Stille oder nichts verstanden: wie im Browser einfach leerer Satz
      if (/No match|No speech input|Didn't understand|Client side error/i.test(msg)) return "";
      throw new Error(LISTEN_ERRORS[msg] ?? `Spracherkennung fehlgeschlagen (${msg}).`);
    }
  })();
  return {
    result,
    stop: () => {
      stopped = true;
      plugin.then((sr) => sr.stop()).catch(() => {});
    },
  };
}

// ---------- Vorlesen ----------

let ttsLang: Promise<string> | null = null;
// Beendet die laufende Äusserung auf JS-Seite: Android meldet bei stop() oder einer neuen Äusserung weder Ende noch Fehler
let interrupt: (() => void) | null = null;

/** Liest Satz für Satz vor; `alive()` false bricht ab (neuer Text oder stopSpeaking). */
export async function appSpeak(parts: string[], alive: () => boolean): Promise<void> {
  const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
  ttsLang ??= TextToSpeech.isLanguageSupported({ lang: "de-CH" })
    .then((r) => (r.supported ? "de-CH" : "de-DE"))
    .catch(() => "de-DE");
  const lang = await ttsLang;
  for (const text of parts) {
    if (!alive()) return;
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(safety);
        if (interrupt === done) interrupt = null;
        resolve();
      };
      // Sicherheitsnetz wie im Browser, falls ein Ende nie gemeldet wird
      const safety = setTimeout(done, 4000 + text.length * 120);
      interrupt?.();
      interrupt = done;
      // Etwas tiefer, damit es mehr nach Jarvis klingt (wie im Browser ohne männliche Stimme)
      TextToSpeech.speak({ text, lang, rate: 1.0, pitch: 0.8, volume: 1.0 }).then(done, done);
    });
  }
}

export function appStopSpeaking() {
  interrupt?.();
  interrupt = null;
  import("@capacitor-community/text-to-speech").then((m) => m.TextToSpeech.stop()).catch(() => {});
}

// ---------- Erinnerungen (lokale Benachrichtigungen) ----------

// Gilt nur für dieses Handy; die Website-Geräte nutzen weiterhin Web Push über den Server.
const NOTIFY_FLAG = "jarvis-app-notify";
const CHANNEL = "erinnerungen";
const FOCUS_ID = 1;
const TEST_ID = 2;
const BREAK_ID = 3;
// Android erlaubt nur eine begrenzte Zahl geplanter Alarme pro App; die nächsten reichen, beim Öffnen wird nachgeplant.
const MAX_SCHEDULED = 60;

const notifications = () => import("@capacitor/local-notifications").then((m) => m.LocalNotifications);

function flagOn() {
  try {
    return localStorage.getItem(NOTIFY_FLAG) === "1";
  } catch {
    return false;
  }
}

/** Stabile, positive 31-Bit-Zahl aus dem Erinnerungs-Schlüssel (FNV-1a); 1 bis 3 sind reserviert. */
export function notificationId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const id = h & 0x7fffffff;
  return id <= BREAK_ID ? id + 4 : id;
}

async function ensureChannel() {
  const ln = await notifications();
  await ln.createChannel({ id: CHANNEL, name: "Erinnerungen", description: "Aufgaben, Prüfungen, Lektionen und Nachbereitung", importance: 4, visibility: 1 });
}

export async function appNotifyState(): Promise<"denied" | "off" | "on"> {
  const p = await (await notifications()).checkPermissions();
  if (p.display === "denied") return "denied";
  return p.display === "granted" && flagOn() ? "on" : "off";
}

export async function appEnableNotify() {
  const ln = await notifications();
  let p = await ln.checkPermissions();
  if (p.display !== "granted") p = await ln.requestPermissions();
  if (p.display !== "granted") throw new Error("Benachrichtigungen wurden nicht erlaubt. Du kannst sie in den App-Einstellungen von Jarvis einschalten.");
  await ensureChannel();
  localStorage.setItem(NOTIFY_FLAG, "1");
  lastNativeHash = "";
}

export async function appDisableNotify() {
  localStorage.removeItem(NOTIFY_FLAG);
  const ln = await notifications();
  const { notifications: pending } = await ln.getPending();
  if (pending.length) await ln.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  lastNativeHash = "";
}

/** Pünktliche Alarme (Android 12+: «Wecker und Erinnerungen»). Ohne sie kommen Erinnerungen evtl. ein paar Minuten später. */
export async function appExactAllowed(): Promise<boolean> {
  try {
    return (await (await notifications()).checkExactNotificationSetting()).exact_alarm === "granted";
  } catch {
    return false;
  }
}

export async function appAllowExact() {
  await (await notifications()).changeExactNotificationSetting();
  lastNativeHash = ""; // beim nächsten Abgleich pünktlich neu planen
}

export async function appTestNotify() {
  await ensureChannel();
  await (await notifications()).schedule({
    notifications: [
      {
        id: TEST_ID,
        title: "Jarvis",
        body: "Testnachricht: Erinnerungen funktionieren.",
        channelId: CHANNEL,
        schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
        isExactNotification: false,
        extra: { url: "/" },
      },
    ],
  });
}

export type FocusAlert = { kind: "focus" | "break"; at: number; title: string; body: string };

/**
 * Plant das Ende der Fokus-Einheit und der Pause im Voraus, damit die Meldung auch bei geschlossener App kommt.
 * [] löscht beides (Timer gestoppt oder pausiert).
 */
export async function appScheduleFocus(alerts: FocusAlert[], now = Date.now()) {
  const ln = await notifications();
  // Nur noch geplante löschen; eine gerade angezeigte Meldung bleibt stehen
  const { notifications: pending } = await ln.getPending();
  const old = pending.filter((n) => n.id === FOCUS_ID || n.id === BREAK_ID);
  if (old.length) await ln.cancel({ notifications: old.map((n) => ({ id: n.id })) });
  const next = alerts.filter((a) => a.at > now + 1000);
  if (!next.length || (await appNotifyPermission()) !== "granted") return;
  await ensureChannel();
  const exact = await appExactAllowed();
  await ln.schedule({
    notifications: next.map((a) => ({
      id: a.kind === "focus" ? FOCUS_ID : BREAK_ID,
      title: a.title,
      body: a.body,
      channelId: CHANNEL,
      isExactNotification: exact,
      schedule: { at: new Date(a.at), allowWhileIdle: true },
      extra: { url: "/fokus" },
    })),
  });
}

export async function appNotifyPermission(): Promise<"granted" | "denied" | "default"> {
  const p = (await (await notifications()).checkPermissions()).display;
  return p === "granted" ? "granted" : p === "denied" ? "denied" : "default";
}

export async function appRequestNotifyPermission(): Promise<"granted" | "denied" | "default"> {
  const p = (await (await notifications()).requestPermissions()).display;
  return p === "granted" ? "granted" : p === "denied" ? "denied" : "default";
}

let lastNativeHash = "";

/** Plant die kommenden Erinnerungen als lokale Benachrichtigungen (ersetzt die bisher geplanten). */
export async function appScheduleReminders(reminders: Reminder[], now = Date.now()) {
  if (!flagOn()) return;
  const ln = await notifications();
  if ((await ln.checkPermissions()).display !== "granted") return;
  const next = reminders.filter((r) => r.dueAt > now + 5000).slice(0, MAX_SCHEDULED);
  const hash = JSON.stringify(next.map((r) => [r.key, r.dueAt, r.title, r.body, r.url]));
  if (hash === lastNativeHash) return;

  const exact = await appExactAllowed();
  const { notifications: pending } = await ln.getPending();
  const old = pending.filter((n) => n.id > BREAK_ID);
  if (old.length) await ln.cancel({ notifications: old.map((n) => ({ id: n.id })) });
  if (next.length) {
    await ensureChannel();
    await ln.schedule({
      notifications: next.map((r) => ({
        id: notificationId(r.key),
        title: r.title,
        body: r.body,
        channelId: CHANNEL,
        // Ohne Erlaubnis für pünktliche Alarme nicht nachfragen (öffnet sonst jedes Mal die Einstellungen), sondern ungefähr planen
        isExactNotification: exact,
        schedule: { at: new Date(r.dueAt), allowWhileIdle: true },
        extra: { url: safeAppPath(r.url) },
      })),
    });
  }
  lastNativeHash = hash;
}

// ---------- Teilen und Dateien ----------

/** Teilt einen Link über das Android-Teilen-Menü. false, wenn abgebrochen. */
export async function appShareUrl(title: string, url: string): Promise<boolean> {
  const { Share } = await import("@capacitor/share");
  try {
    await Share.share({ title, url, dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}

/** Downloads gibt es in der WebView nicht: Datei im App-Cache ablegen und über das Teilen-Menü speichern/senden. */
export async function appShareFile(fileName: string, text: string, title: string): Promise<boolean> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const path = fileName.replace(/[^\w.\-äöüÄÖÜ ]/g, "_");
  const { uri } = await Filesystem.writeFile({ path, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title, files: [uri], dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}
