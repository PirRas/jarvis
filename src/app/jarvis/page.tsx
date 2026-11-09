"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { Wireframe } from "@/components/Wireframe";
import { loadSettings, saveTimer } from "@/lib/focus";
import { getGeminiKey, setGeminiKey } from "@/lib/gemini";
import { briefing, userName } from "@/lib/briefing";
import { greeting } from "@/lib/jarvis";
import { askJarvis, type ChatTurn } from "@/lib/jarvisAgent";
import { canListen, listen, speak, speaker, stopSpeaking } from "@/lib/speech";
import type { ChatRecord } from "@/lib/assistant";
import { deleteItems, listItems, putItem } from "@/lib/db";
import { fmtShortDay, fmtTime } from "@/lib/planner";
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
  nachbereitung_erledigt: "Nachbereitung abgehakt",
  nachbereitung_verschieben: "Nachbereitung verschoben",
  keine_zeit: "Zeit gesperrt",
  lernzeiten_einstellen: "Lernzeiten geändert",
  merken: "Gemerkt",
  vergessen: "Vergessen",
};
const MAX_TURNS = 20;
const MAX_CHATS = 50; // ältere Gespräche werden gelöscht
const RESUME_MS = 3 * 60 * 60_000; // jüngeres Gespräch beim Öffnen fortsetzen

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
  // Verbindung zu Gemini schon beim Öffnen aufbauen: spart beim ersten Satz den TLS-Handschlag
  preconnect("https://generativelanguage.googleapis.com", { crossOrigin: "anonymous" });
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [log, setLog] = useState<Msg[]>([]);
  const [interim, setInterim] = useState("");
  const [live, setLive] = useState(""); // Antwort, während sie noch entsteht
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(true);
  const [talk, setTalk] = useState(false);
  const [startOn, setStartOn] = useState(true);
  const [hasKey, setHasKey] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [mic, setMic] = useState(true);
  const [chats, setChats] = useState<ChatRecord[] | null>(null); // Verlauf offen, wenn gesetzt
  const history = useRef<ChatTurn[]>([]);
  const chat = useRef<{ id: string; createdAt: number }>({ id: "", createdAt: 0 });
  const rec = useRef<{ stop(): void } | null>(null);
  const busy = useRef(false); // wartet gerade auf die KI
  const turn = useRef(0); // zählt Antworten, damit eine unterbrochene nicht weiterläuft
  const flags = useRef({ voice: true, talk: false });
  const name = useRef(""); // Vorname aus dem Konto
  const greetAt = useRef(0); // wann die Begrüssung zu sprechen begann
  const greetDone = useRef<Promise<void> | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);

  const say = useCallback(async (msg: string) => {
    if (!flags.current.voice) return;
    setState("speaking");
    await speak(msg).catch(() => {}); // Vorlesen ist Zusatz; die Antwort steht ja da
  }, []);

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
    // Begrüssung mit Namen, Tagesprogramm und offenen Aufgaben, ohne dass man etwas sagen muss
    let offTap = () => {};
    userName(dbStore).then((n) => (name.current = n), () => {});
    chat.current = { id: crypto.randomUUID(), createdAt: Date.now() };
    // Gespräch von vorhin fortsetzen; sonst neu mit Begrüssung
    listItems("chats")
      .then((all) => {
        const sorted = all.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
        if (sorted.length > MAX_CHATS) void deleteItems("chats", sorted.slice(MAX_CHATS).map((c) => c.id));
        const last = sorted[0];
        if (last && Date.now() - (last.updatedAt ?? last.createdAt) < RESUME_MS) {
          open(last);
          throw new Error("fortgesetzt");
        }
      }, () => {})
      .then(() => briefing(dbStore))
      .then((text) => {
        setLog((l) => (l.length ? l : [{ role: "jarvis", text }]));
        if (!flags.current.voice) return;
        const greet = () => {
          greetAt.current = Date.now();
          const id = turn.current;
          greetDone.current = say(text).then(() => {
            if (id === turn.current) setState("idle");
          });
        };
        // Browser lesen erst nach der ersten Berührung vor; beim Start aus dem Startbildschirm also beim ersten Tippen
        const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
        if (nav.userActivation?.hasBeenActive) return greet();
        const onTap = () => {
          offTap();
          greet();
        };
        offTap = () => {
          window.removeEventListener("pointerdown", onTap, true);
          window.removeEventListener("keydown", onTap, true);
        };
        window.addEventListener("pointerdown", onTap, true);
        window.addEventListener("keydown", onTap, true);
      })
      .catch(() => {});
    return () => {
      offTap();
      rec.current?.stop();
      stopSpeaking();
    };
  }, [say]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [log, interim, live]);

  // Gespräch speichern (wird abgeglichen), sobald etwas gefragt wurde
  useEffect(() => {
    const first = log.find((m) => m.role === "user");
    if (!first || !chat.current.id) return;
    void putItem("chats", {
      id: chat.current.id,
      title: first.text.slice(0, 80),
      messages: log,
      history: history.current,
      createdAt: chat.current.createdAt,
    });
  }, [log]);

  function open(c: ChatRecord) {
    chat.current = { id: c.id, createdAt: c.createdAt };
    history.current = c.history as ChatTurn[];
    setLog(c.messages);
    setChats(null);
  }

  function fresh() {
    turn.current++;
    stopSpeaking();
    chat.current = { id: crypto.randomUUID(), createdAt: Date.now() };
    history.current = [];
    setLog([]);
    setLive("");
    setChats(null);
  }

  async function showChats() {
    if (chats) return setChats(null);
    const all = await listItems("chats");
    setChats(all.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)));
  }

  async function removeChat(id: string) {
    await deleteItems("chats", [id]);
    if (id === chat.current.id) fresh();
    setChats((l) => l?.filter((c) => c.id !== id) ?? null);
  }

  function toggle(key: string, on: boolean, set: (v: boolean) => void, name?: "voice" | "talk") {
    set(on);
    localStorage.setItem(key, on ? "1" : "0");
    if (name) flags.current[name] = on;
    if (key === "jarvis-voice" && !on) stopSpeaking();
  }


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
        name: name.current,
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
      // Vorlesen beginnt mit dem ersten fertigen Satz, nicht erst nach der ganzen Antwort
      const sp = flags.current.voice ? speaker() : null;
      let streamed = "";
      const onText = (t: string) => {
        streamed += t;
        setLive(streamed);
        if (!sp) return;
        sp.push(t);
        setState((s) => (s === "thinking" ? "speaking" : s));
      };
      let reply: string;
      try {
        const r = await askJarvis(input, history.current, ctx, onText);
        history.current = trim(r.history);
        setLog((l) => [...l, { role: "jarvis", text: r.reply, actions: r.actions }, ...extra]);
        reply = r.reply;
      } catch (e) {
        const m = e instanceof Error ? e.message : "Das hat nicht geklappt. Bitte nochmal versuchen.";
        setLog((l) => [...l, ...(streamed.trim() ? [{ role: "jarvis" as const, text: streamed.trim() }] : []), { role: "error", text: m }]);
        reply = m.length > 120 ? "Das hat leider nicht geklappt. Bitte versuch es nochmal." : m;
      }
      setLive("");
      // Ab hier darf schon die nächste Frage kommen; sie unterbricht das Vorlesen
      busy.current = false;
      const id = ++turn.current;
      if (sp) {
        // Was nicht schon gestreamt wurde (Fehler, "Erledigt.") jetzt noch sagen
        if (reply !== streamed.trim()) sp.push(` ${reply}`);
        setState("speaking");
        await sp.end();
      }
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
    // Erste Berührung startet die Begrüssung: ausreden lassen, danach zuhören
    if (Date.now() - greetAt.current < 1500 && greetDone.current) {
      greetAt.current = 0;
      const id = turn.current;
      void greetDone.current.then(() => id === turn.current && start());
      return;
    }
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
      <Link className="jv-home" href="/heute" aria-label="Zum Cockpit">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
          <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
        </svg>
        Cockpit
      </Link>
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
        <button type="button" className="jv-link" onClick={() => void showChats()} aria-expanded={!!chats}>
          Verlauf
        </button>
        {log.some((m) => m.role === "user") && (
          <button type="button" className="jv-link" onClick={fresh}>
            Neues Gespräch
          </button>
        )}
      </div>

      {chats && (
        <div className="jv-chats" role="dialog" aria-label="Frühere Gespräche">
          <div className="jv-row spread">
            <strong>Frühere Gespräche</strong>
            <button type="button" className="jv-link" onClick={() => setChats(null)}>
              Schliessen
            </button>
          </div>
          {chats.length === 0 ? (
            <p className="jv-hint">Noch keine gespeicherten Gespräche.</p>
          ) : (
            <ul>
              {chats.map((c) => (
                <li key={c.id} className={c.id === chat.current.id ? "is-current" : ""}>
                  <button type="button" className="jv-chat-open" onClick={() => open(c)}>
                    <span>{c.title}</span>
                    <small>
                      {fmtShortDay(c.updatedAt ?? c.createdAt)}, {fmtTime(c.updatedAt ?? c.createdAt)} · {c.messages.length} Nachrichten
                    </small>
                  </button>
                  <button type="button" className="jv-link" onClick={() => void removeChat(c.id)} aria-label={`Gespräch „${c.title}“ löschen`}>
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="jv-orbwrap">
        <Wireframe className="jv-wire" />
        <button className="jv-orb" onClick={onOrb} aria-label={state === "listening" ? "Zuhören beenden" : "Mit Jarvis sprechen"} disabled={!mic && state !== "speaking"}>
          <Orb />
        </button>
      </div>
      <h1 className="jv-title" aria-label="J.A.R.V.I.S.">
        {[..."J.A.R.V.I.S."].map((c, i) => (
          <span key={i} aria-hidden style={{ "--i": i } as React.CSSProperties}>
            {c}
          </span>
        ))}
      </h1>
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
            <input type="password" name="gemini-key" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoComplete="off" aria-label="Gemini-Schlüssel" />
            <button className="btn" onClick={saveKey} disabled={!keyInput.trim()} aria-label="Gemini-Schlüssel speichern">
              Speichern
            </button>
          </div>
        </div>
      )}

      <div className="jv-log" role="log">
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
        {live && <div className="jv-msg is-jarvis">{live}</div>}
        {!log.some((m) => m.role === "user") && (
          <div className="jv-chips">
            {SUGGESTIONS.map((s, i) => (
              <button key={s} className="jv-chip" style={{ "--i": i } as React.CSSProperties} onClick={() => void ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={logEnd} />
      </div>

      <form className="jv-form" onSubmit={submit}>
        {!mic && <p className="jv-hint">Spracheingabe geht hier nicht, schreib stattdessen.</p>}
        <div className="jv-row">
          <input name="nachricht" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="Frag etwas …" aria-label="Nachricht an Jarvis" />
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
// Partikel: [Radius, Bahnradius, Umlaufzeit in s, Startwinkel]
const PARTICLES: [number, number, number, number][] = [
  [2, 64, 7, 0],
  [1.5, 78, 11, 120],
  [2.5, 92, 9, 240],
  [1.5, 110, 15, 60],
  [2, 132, 12, 200],
  [2, 70, 13, 300],
  [1.5, 120, 8, 150],
  [2.5, 86, 17, 20],
];
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
      <g className="jv-boot" style={{ "--n": 0 } as React.CSSProperties}>
        <g className="jv-r1">
          <circle cx="160" cy="160" r="144" fill="none" stroke={C} strokeOpacity="0.6" strokeWidth="8" strokeDasharray={`1.4 ${circ(144) / 90 - 1.4}`} />
          <circle cx="160" cy="160" r="144" fill="none" stroke={C} strokeWidth="12" strokeDasharray={`2.2 ${(circ(144) / 90) * 6 - 2.2}`} />
        </g>
      </g>
      <g className="jv-boot" style={{ "--n": 1 } as React.CSSProperties}>
        <g className="jv-r2" filter="url(#jv-glow)">
          <circle cx="160" cy="160" r="122" fill="none" stroke={C} strokeOpacity="0.8" strokeWidth="14" strokeDasharray={`${circ(122) / 24 - 4} 4`} />
        </g>
      </g>
      <g className="jv-boot" style={{ "--n": 2 } as React.CSSProperties}>
        <g className="jv-r3">
          <circle cx="160" cy="160" r="102" fill="none" stroke={AMBER} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${circ(102) * 0.28} ${circ(102)}`} />
          <circle cx="160" cy="160" r="102" fill="none" stroke={AMBER} strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${circ(102) * 0.08} ${circ(102)}`} transform="rotate(180 160 160)" />
        </g>
      </g>
      <g className="jv-scan">
        <circle cx="160" cy="160" r="84" fill="none" stroke={C} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${circ(84) * 0.22} ${circ(84)}`} />
      </g>
      <g className="jv-arc">
        <path d="M160 68A92 92 0 1 1 128.5 246.5" fill="none" stroke={AMBER} strokeWidth="2" strokeLinecap="round" strokeDasharray="6 6" />
      </g>
      <g className="jv-boot" style={{ "--n": 3 } as React.CSSProperties}>
        <g className="jv-r4">
          <circle cx="160" cy="160" r="72" fill="none" stroke={C} strokeOpacity="0.35" strokeDasharray="3 6" />
        </g>
      </g>
      {PARTICLES.map(([r, rad, dur, deg], i) => (
        <g key={i} className="jv-p" style={{ "--d": `${dur}s`, animationDelay: `${-(dur * deg) / 360}s` } as React.CSSProperties}>
          <circle cx={160 + rad} cy="160" r={r} fill="#d8fbff" />
        </g>
      ))}
      <circle className="jv-core" cx="160" cy="160" r="52" fill="url(#jv-core)" filter="url(#jv-glow)" />
      <circle cx="160" cy="160" r="52" fill="none" stroke={C} strokeWidth="1.5" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} className="jv-bar" style={{ "--i": i } as React.CSSProperties} x={160 + (i - 3) * 10 - 2} y="142" width="4" height="36" rx="2" fill="#071a2a" />
      ))}
    </svg>
  );
}
