// Sprache im Browser: Spracherkennung (Web Speech API) und Vorlesen (speechSynthesis). Nur im Client nutzbar.
// In der Android-App übernehmen native Plugins (native.ts), weil die WebView beides nicht kann.

import { appListen, appSpeak, appStopSpeaking, isNativeApp } from "./native";

type Alt = { transcript: string };
type Res = { isFinal: boolean; 0: Alt };
type RecEvent = { resultIndex: number; results: ArrayLike<Res> };
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecCtor = new () => Rec;

function recCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => isNativeApp() || recCtor() !== null;

const ERRORS: Record<string, string> = {
  "not-allowed": "Mikrofon nicht erlaubt. Erlaube den Zugriff in den Browser-Einstellungen.",
  "service-not-allowed": "Mikrofon nicht erlaubt. Erlaube den Zugriff in den Browser-Einstellungen.",
  "audio-capture": "Kein Mikrofon gefunden.",
  network: "Die Spracherkennung braucht eine Internetverbindung.",
};

/** Hört einmal zu. result liefert den fertigen Satz ('' bei Stille); stop() beendet das Zuhören vorzeitig. */
export function listen({ onInterim }: { onInterim?: (t: string) => void }): { result: Promise<string>; stop(): void } {
  if (isNativeApp()) return appListen();
  const Ctor = recCtor();
  let rec: Rec | null = null;
  const result = new Promise<string>((resolve, reject) => {
    if (!Ctor) return reject(new Error("Spracherkennung wird in diesem Browser nicht unterstützt."));
    let text = "";
    const run = (lang: string) => {
      const r = new Ctor();
      rec = r;
      r.lang = lang;
      r.interimResults = true;
      r.continuous = false;
      r.onresult = (e) => {
        text = Array.from(e.results, (x) => x[0].transcript).join(" ").trim();
        onInterim?.(text);
      };
      r.onerror = (e) => {
        if (e.error === "language-not-supported" && lang === "de-CH") {
          r.onend = null;
          return run("de-DE");
        }
        r.onend = null;
        if (e.error === "no-speech" || e.error === "aborted") return resolve(text);
        reject(new Error(ERRORS[e.error] ?? `Spracherkennung fehlgeschlagen (${e.error}).`));
      };
      r.onend = () => resolve(text);
      try {
        r.start();
      } catch {
        reject(new Error("Spracherkennung konnte nicht starten."));
      }
    };
    run("de-CH");
  });
  return { result, stop: () => rec?.stop() };
}

// ---------- Vorlesen ----------

const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

export const canSpeak = () => isNativeApp() || synth() !== null;

// Männliche Stimmen nach Namen (Windows/Edge, macOS/iOS); Android und Chrome verraten das Geschlecht nicht.
const MALE = /\b(jan|conrad|killian|florian|stefan|markus|yannick|viktor|martin|ralf|bernd|christoph|kasper|klaus|male|männlich)\b/i;

/** Beste deutsche Stimme: männlich vor weiblich, "Natural"/"Online" (neuronal, klingt natürlich) vor klassisch, de-CH vor de-DE. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const lang = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-");
  const score = (v: SpeechSynthesisVoice) =>
    (MALE.test(v.name) ? 8 : 0) + (/natural|online|neural|premium|enhanced/i.test(v.name) ? 4 : 0) + (lang(v) === "de-CH" ? 2 : lang(v) === "de-DE" ? 1 : 0);
  return (synth()?.getVoices() ?? [])
    .filter((v) => lang(v).toLowerCase().startsWith("de"))
    .sort((a, b) => score(b) - score(a))[0];
}

/** Stimmen laden in manchen Browsern erst nach dem Start nach. */
function voicesReady(): Promise<void> {
  const s = synth();
  if (!s || s.getVoices().length) return Promise.resolve();
  return new Promise((res) => {
    const done = () => {
      s.removeEventListener("voiceschanged", done);
      res();
    };
    s.addEventListener("voiceschanged", done);
    setTimeout(done, 800);
  });
}

const clean = (t: string) =>
  t
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>~|]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

let gen = 0;
// Chrome verliert sonst Äusserungen an die Speicherbereinigung, und onend kommt nie
let alive: SpeechSynthesisUtterance[] = [];

/** Ein Satz im Browser; löst nach dem Ende auf (oder nach dem Sicherheitsnetz, falls der Browser es nie meldet). */
function sayOne(s: SpeechSynthesis, text: string, voice: SpeechSynthesisVoice | undefined) {
  return new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const done = () => {
      clearTimeout(safety);
      alive = alive.filter((x) => x !== u);
      resolve();
    };
    const safety = setTimeout(done, 4000 + text.length * 120);
    u.lang = voice?.lang ?? "de-CH";
    if (voice) u.voice = voice;
    u.rate = 1.0;
    // Ohne erkennbar männliche Stimme etwas tiefer, damit es mehr nach Jarvis klingt
    u.pitch = voice && MALE.test(voice.name) ? 1 : 0.8;
    u.onend = done;
    u.onerror = done;
    alive.push(u);
    s.speak(u);
  });
}

/**
 * Vorlesen, während die Antwort noch entsteht: push() nimmt Textstücke an, jeder fertige Satz wird sofort gesprochen,
 * der Rest folgt der Reihe nach (whole: Stück ist schon ein ganzer Satz). end() schliesst ab und löst auf, wenn alles gesagt ist. stopSpeaking() bricht ab.
 */
const ABBR = /\b(dr|prof|bzw|ca|nr|vgl|usw|evtl|inkl|max|min|st)\.$/i; // kein Satzende
const MAX_CHUNK = 220;

export function speaker(): { push(t: string, whole?: boolean): void; end(): Promise<void> } {
  const mine = ++gen;
  const s = synth();
  if (!isNativeApp()) s?.cancel();
  let buf = "";
  let queue: Promise<unknown> = isNativeApp() || !s ? Promise.resolve() : voicesReady();
  let voice: SpeechSynthesisVoice | undefined;
  const say = (text: string) => {
    const t = clean(text);
    if (!t || (!isNativeApp() && !s)) return;
    queue = queue.then(() => {
      if (mine !== gen) return;
      if (isNativeApp()) return appSpeak([t], () => mine === gen);
      voice ??= pickVoice();
      return sayOne(s!, t, voice);
    });
  };
  return {
    push(t, whole = false) {
      if (mine !== gen) return;
      buf += t;
      // Satzende: ! ? ; : oder ein Punkt nach einem Wort (nicht "20." oder "z. B."), danach Leerzeichen und beim Punkt ein
      // Grossbuchstabe. Sehr kurze Stücke warten auf mehr, sonst klingt es abgehackt.
      let from = 0;
      for (const m of buf.matchAll(/([!?;:]|[^\d\s.]{2}\.)(\s+)(?=(\S))/g)) {
        const end = (m.index ?? 0) + m[1].length;
        if (end - from < 12 || (m[1].endsWith(".") && (!/[A-ZÄÖÜ]/.test(m[3]) || ABBR.test(buf.slice(from, end))))) continue;
        say(buf.slice(from, end));
        from = end + m[2].length;
      }
      buf = buf.slice(from);
      // Ohne Satzende nicht endlos sammeln (Chrome bricht lange Äusserungen ab): am letzten Komma oder Leerzeichen teilen
      if (buf.length > MAX_CHUNK) {
        const cut = Math.max(buf.lastIndexOf(", ", MAX_CHUNK), buf.lastIndexOf(" ", MAX_CHUNK));
        if (cut > 0) {
          say(buf.slice(0, cut + 1));
          buf = buf.slice(cut + 1);
        }
      }
      if (whole) {
        say(buf);
        buf = "";
      }
    },
    async end() {
      say(buf);
      buf = "";
      await queue.catch(() => {});
    },
  };
}

/** Liest den Text laut vor, Satz für Satz (Chrome bricht lange Äusserungen ab). */
export async function speak(text: string): Promise<void> {
  const sp = speaker();
  for (const part of clean(text).match(/[^.!?:;\n]+[.!?:;]?/g) ?? []) sp.push(part, true);
  return sp.end();
}

export function stopSpeaking() {
  gen++;
  if (isNativeApp()) appStopSpeaking();
  else synth()?.cancel();
}
