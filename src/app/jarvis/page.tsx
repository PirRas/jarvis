"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadSettings, saveTimer } from "@/lib/focus";
import { getGeminiKey, setGeminiKey } from "@/lib/gemini";
import { greeting } from "@/lib/jarvis";
import { askJarvis, type ChatTurn } from "@/lib/jarvisAgent";
import { canListen, listen, speak, stopSpeaking } from "@/lib/speech";
import { dbStore, type ToolContext } from "@/lib/voiceTools";
import "./jarvis.css";

type State = "idle" | "listening" | "thinking" | "speaking";
type Msg = { role: "user" | "jarvis" | "error"; text: string; actions?: string[]; link?: string };

const STATE_LABEL: Record<State, string> = { idle: "Bereit", listening: "Ich höre zu …", thinking: "Einen Moment …", speaking: "Spricht" };
const SUGGESTIONS = ["Was steht heute an?", "Welche Aufgaben sind offen?", "Trag morgen um 14 Uhr einen Termin ein", "Starte einen Fokus-Timer"];
const ACTION_LABEL: Record<string, string> = {
  termin_anlegen: "Termin eingetragen",
  termin_aendern: "Termin geändert",
  termin_loeschen: "Termin gelöscht",
  aufgabe_anlegen: "Aufgabe eingetragen",
  aufgabe_aendern: "Aufgabe geändert",
  aufgabe_loeschen: "Aufgabe gelöscht",
  lernzeit_eintragen: "Lernzeit eingetragen",
  note_eintragen: "Note eingetragen",
  fokus_starten: "Fokus gestartet",
  seite_oeffnen: "Seite geöffnet",
  link_oeffnen: "Link geöffnet",
};
const MAX_TURNS = 20;

/** Verlauf kürzen, ohne functionCall und functionResponse zu trennen: am Anfang einen Text-Beitrag des Nutzers behalten. */
function trim(h: ChatTurn[]): ChatTurn[] {
  if (h.length <= MAX_TURNS) return h;
  let i = h.length - MAX_TURNS;
  while (i < h.length && !(h[i].role === "user" && h[i].parts.some((p) => "text" in p))) i++;
  return h.slice(i);
}

const flag = (key: string, def: boolean) => {
  const v = localStorage.getItem(key);
  return v === null ? def : v !== "0";
};

export default function JarvisPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [log, setLog] = useState<Msg[]>([]);
  const [interim, setInterim] = useState("");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(true);
  const [talk, setTalk] = useState(false);
  const [startOn, setStartOn] = useState(true);
  const [hasKey, setHasKey] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [mic, setMic] = useState(true);
  const history = useRef<ChatTurn[]>([]);
  const rec = useRef<{ stop(): void } | null>(null);
  const busy = useRef(false); // wartet gerade auf die KI
  const turn = useRef(0); // zählt Antworten, damit eine unterbrochene nicht weiterläuft
  const flags = useRef({ voice: true, talk: false });
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem("jarvis-intro", "1");
    const v = flag("jarvis-voice", true);
    const t = flag("jarvis-talk", false);
    flags.current = { voice: v, talk: t };
    setVoice(v);
    setTalk(t);
    setStartOn(flag("jarvis-start", true));
    setHasKey(Boolean(getGeminiKey()));
    setMic(canListen());
    return () => {
      rec.current?.stop();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [log, interim]);

  function toggle(key: string, on: boolean, set: (v: boolean) => void, name?: "voice" | "talk") {
    set(on);
    localStorage.setItem(key, on ? "1" : "0");
    if (name) flags.current[name] = on;
    if (key === "jarvis-voice" && !on) stopSpeaking();
  }

  const say = useCallback(async (msg: string) => {
    if (!flags.current.voice) return;
    setState("speaking");
    await speak(msg).catch(() => {}); // Vorlesen ist Zusatz; die Antwort steht ja da
  }, []);

  const ask = useCallback(
    async (q: string) => {
      const input = q.trim();
      if (!input || busy.current) return;
      busy.current = true;
      turn.current++;
      stopSpeaking();
      setInterim("");
      setLog((l) => [...l, { role: "user", text: input }]);
      setState("thinking");
      let nav: string | null = null;
      const extra: Msg[] = [];
      const ctx: ToolContext = {
        store: dbStore,
        now: Date.now(),
        navigate: (path) => (nav = path),
        openUrl: (url) => {
          if (!window.open(url, "_blank", "noopener")) extra.push({ role: "jarvis", text: url, link: url });
        },
        startFocus: (course, minutes) => {
          const s = loadSettings();
          saveTimer({ phase: "focus", course, minutes: minutes || s.focus, breakMinutes: s.brk, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
          nav = "/fokus";
        },
      };
      let reply: string;
      try {
        const r = await askJarvis(input, history.current, ctx);
        history.current = trim(r.history);
        setLog((l) => [...l, { role: "jarvis", text: r.reply, actions: r.actions }, ...extra]);
        reply = r.reply;
      } catch (e) {
        const m = e instanceof Error ? e.message : "Das hat nicht geklappt.";
        setLog((l) => [...l, { role: "error", text: m }]);
        reply = m.length > 120 ? "Das hat leider nicht geklappt." : m;
      }
      // Ab hier darf schon die nächste Frage kommen; sie unterbricht das Vorlesen
      busy.current = false;
      const id = ++turn.current;
      await say(reply);
      if (id !== turn.current) return;
      setState("idle");
      if (nav) {
        const to = nav;
        setTimeout(() => router.push(to), 1200);
      } else if (flags.current.talk && canListen()) start();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say, router],
  );

  function start() {
    if (busy.current) return;
    turn.current++;
    stopSpeaking();
    setInterim("");
    setState("listening");
    const l = listen({ onInterim: setInterim });
    rec.current = l;
    l.result
      .then((t) => {
        rec.current = null;
        if (t) void ask(t);
        else setState("idle");
      })
      .catch((e: Error) => {
        rec.current = null;
        setState("idle");
        setLog((m) => [...m, { role: "error", text: e.message }]);
      });
  }

  function onOrb() {
    if (state === "listening") rec.current?.stop();
    else if (state === "speaking") stopSpeaking(); // ins Wort fallen: danach wieder bereit
    else if (state !== "thinking") start();
  }

  // Leertaste als Kurzbefehl (nicht beim Tippen)
  const orbRef = useRef(onOrb);
  orbRef.current = onOrb;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== "Space" || /^(INPUT|TEXTAREA|BUTTON)$/.test(el.tagName) || !canListen()) return;
      e.preventDefault();
      orbRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function saveKey() {
    setGeminiKey(keyInput.trim());
    setHasKey(true);
    setKeyInput("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text;
    setText("");
    void ask(t);
  }

  return (
    <div className="jarvis-screen" data-state={state}>
      <button className="jv-home" onClick={() => router.push("/")} aria-label="Zum Cockpit">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
          <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
        </svg>
        Cockpit
      </button>
      <div className="jv-toggles">
        <label>
          <input type="checkbox" checked={voice} onChange={(e) => toggle("jarvis-voice", e.target.checked, setVoice, "voice")} /> Stimme
        </label>
        <label>
          <input type="checkbox" checked={talk} onChange={(e) => toggle("jarvis-talk", e.target.checked, setTalk, "talk")} /> Gespräch
        </label>
        <label>
          <input type="checkbox" checked={startOn} onChange={(e) => toggle("jarvis-start", e.target.checked, setStartOn)} /> Beim Start
        </label>
      </div>

      <button className="jv-orb" onClick={onOrb} aria-label={state === "listening" ? "Zuhören beenden" : "Mit Jarvis sprechen"} disabled={!mic && state !== "speaking"}>
        <Orb />
      </button>
      <h1 className="jv-title">J.A.R.V.I.S.</h1>
      {log.length === 0 && <p className="jv-greet">{greeting()}. Womit kann ich dienen?</p>}
      <p className="jv-state" aria-live="polite">
        {STATE_LABEL[state]}
        {interim && <span className="jv-interim"> „{interim}“</span>}
      </p>

      {!hasKey && (
        <div className="jv-key">
          <p>
            Für Jarvis brauchst du einen kostenlosen Gemini-Schlüssel von{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>
            . Er bleibt nur in diesem Browser.
          </p>
          <div className="jv-row">
            <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoComplete="off" aria-label="Gemini-Schlüssel" />
            <button className="btn" onClick={saveKey} disabled={!keyInput.trim()} aria-label="Gemini-Schlüssel speichern">
              Speichern
            </button>
          </div>
        </div>
      )}

      <div className="jv-log" role="log">
        {log.length === 0 && (
          <div className="jv-chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="jv-chip" onClick={() => void ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {log.map((m, i) => (
          <div key={i} className={`jv-msg is-${m.role}`}>
            {m.link ? (
              <a href={m.link} target="_blank" rel="noreferrer">
                {m.link}
              </a>
            ) : (
              m.text
            )}
            {m.actions?.some((a) => ACTION_LABEL[a]) && (
              <span className="jv-actions">
                {m.actions.filter((a) => ACTION_LABEL[a]).map((a, j) => (
                  <span key={j} className="jv-action">
                    {ACTION_LABEL[a]}
                  </span>
                ))}
              </span>
            )}
          </div>
        ))}
        <div ref={logEnd} />
      </div>

      <form className="jv-form" onSubmit={submit}>
        {!mic && <p className="jv-hint">Spracheingabe geht hier nicht, schreib stattdessen.</p>}
        <div className="jv-row">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Oder tippe etwas …" aria-label="Nachricht an Jarvis" />
          {mic && (
            <button type="button" className="jv-mic" onClick={onOrb} aria-label={state === "listening" ? "Zuhören beenden" : "Mikrofon einschalten"}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </button>
          )}
          <button className="btn" type="submit" disabled={!text.trim() || state === "thinking"} aria-label="Senden">
            Senden
          </button>
        </div>
      </form>
    </div>
  );
}

const C = "#46d5f5";
const AMBER = "#f2b13d";
const circ = (r: number) => 2 * Math.PI * r;

/** Reaktor-Orb: Ringe drehen je nach Zustand (data-state am Elternelement, siehe jarvis.css). */
function Orb() {
  return (
    <svg className="jv-svg" viewBox="0 0 320 320" aria-hidden focusable="false">
      <defs>
        <radialGradient id="jv-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d8fbff" />
          <stop offset="35%" stopColor={C} />
          <stop offset="100%" stopColor="#071a2a" />
        </radialGradient>
        <filter id="jv-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle className="jv-ripple" cx="160" cy="160" r="100" fill="none" stroke={C} strokeWidth="2" />
      <circle className="jv-ripple jv-ripple2" cx="160" cy="160" r="100" fill="none" stroke={C} strokeWidth="2" />
      <circle cx="160" cy="160" r="154" fill="none" stroke={C} strokeOpacity="0.22" />
      <g className="jv-r1">
        <circle cx="160" cy="160" r="144" fill="none" stroke={C} strokeOpacity="0.6" strokeWidth="8" strokeDasharray={`1.4 ${circ(144) / 90 - 1.4}`} />
        <circle cx="160" cy="160" r="144" fill="none" stroke={C} strokeWidth="12" strokeDasharray={`2.2 ${(circ(144) / 90) * 6 - 2.2}`} />
      </g>
      <g className="jv-r2" filter="url(#jv-glow)">
        <circle cx="160" cy="160" r="122" fill="none" stroke={C} strokeOpacity="0.8" strokeWidth="14" strokeDasharray={`${circ(122) / 24 - 4} 4`} />
      </g>
      <g className="jv-r3">
        <circle cx="160" cy="160" r="102" fill="none" stroke={AMBER} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${circ(102) * 0.28} ${circ(102)}`} />
        <circle cx="160" cy="160" r="102" fill="none" stroke={AMBER} strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${circ(102) * 0.08} ${circ(102)}`} transform="rotate(180 160 160)" />
      </g>
      <g className="jv-scan">
        <circle cx="160" cy="160" r="84" fill="none" stroke={C} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${circ(84) * 0.22} ${circ(84)}`} />
      </g>
      <g className="jv-r4">
        <circle cx="160" cy="160" r="72" fill="none" stroke={C} strokeOpacity="0.35" strokeDasharray="3 6" />
      </g>
      <circle className="jv-core" cx="160" cy="160" r="52" fill="url(#jv-core)" filter="url(#jv-glow)" />
      <circle cx="160" cy="160" r="52" fill="none" stroke={C} strokeWidth="1.5" />
    </svg>
  );
}
