"use client";

// Automatische Aufbereitung mit kostenlosen KI-Kontingenten, direkt im Browser (kein Server-Zeitlimit,
// keine Upload-Grenze von Vercel, Schlüssel bleiben auf dem Gerät).
// Kette: Gemini Flash → Gemini Flash-Lite (eigenes Kontingent) → OpenRouter-Gratismodelle (nur Folientext, keine Websuche).
// Ablauf wie im claude.ai-Chat: PDF + Prompt 1, dann Prompt 2 im selben Verlauf, dann Prompt 3 mit Google-Suche.

import { z } from "zod";
import { readPdf, type SlideText } from "./pdfText";
import { gradePrompt, videosPrompt } from "./prompts";
import { GradeSchema, NotesSchema, StudySchema, parseClaudeJson, type Notes, type QuizQuestion, type Video } from "./schema";

// Das neueste Modell (hinter "gemini-flash-latest") ist im Gratis-Kontingent oft überlastet und hängt minutenlang,
// deshalb zuletzt; Flash-Lite antwortet auch unter Last in Sekunden (Test 15.10.2026).
// Verschwindet ein Modell (404 "no longer available"), springt die Kette von selbst weiter.
export const GEMINI_MODELS = [
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { id: "gemini-flash-lite-latest", label: "Gemini Flash-Lite" },
  { id: "gemini-flash-latest", label: "Gemini Flash (neuestes)" },
];
// Sprachassistent: eigene Reihenfolge mit wenig Nachdenken. Gemini 3 denkt sonst auf Stufe "medium" und braucht dafür
// pro Runde Sekunden; "low" reicht für Termine, Aufgaben und Rückfragen und antwortet deutlich schneller.
// 3.5 Flash ist abgekündigt und wird ohnehin auf 3.6 umgeleitet. Kennt ein Modell thinkingLevel nicht (2.5er), geht es ohne.
export const VOICE_MODELS = [
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", thinking: "low" },
  { id: "gemini-flash-lite-latest", label: "Gemini Flash-Lite", thinking: "minimal" },
  { id: "gemini-flash-latest", label: "Gemini Flash (neuestes)", thinking: "low" },
];
// shortcut: Gratismodelle bei OpenRouter wechseln; fallen beide weg, auf openrouter.ai/models?q=free neue eintragen
export const OPENROUTER_MODELS = [
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron Ultra (OpenRouter)" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron Super (OpenRouter)" },
];
// Hängende Anfragen (Überlast ohne Fehlermeldung) abbrechen; eine gesunde Antwort kommt auch bei langen Folien in 1–2 Minuten.
const TIMEOUT = 180_000;
const MAX_PDF = 18 * 1024 * 1024; // shortcut: PDF geht inline mit (Grenze ~20 MB), bei grösseren Dateien Files-API einbauen

function stored(name: string) {
  return {
    get: () => {
      try {
        return localStorage.getItem(name) ?? "";
      } catch {
        return "";
      }
    },
    set: (k: string) => {
      try {
        localStorage.setItem(name, k.trim());
      } catch {
        // Speicher nicht verfügbar: Schlüssel gilt nur bis zum Neuladen.
      }
    },
  };
}
const geminiKey = stored("gemini-key");
const openRouterKey = stored("openrouter-key");
export const { get: getGeminiKey, set: setGeminiKey } = geminiKey;
export const { get: getOpenRouterKey, set: setOpenRouterKey } = openRouterKey;
export const { get: getYouTubeKey, set: setYouTubeKey } = stored("youtube-key");

/** Ein Chat-Schritt. pdf ist die Datei für Gemini; OpenRouter bekommt stattdessen den ausgelesenen Folientext. */
type Msg = { role: "user" | "model"; text: string; pdf?: { base64: string; slides: () => Promise<SlideText[]> } };
type Reply = { text: string; via: string };

class KeyError extends Error {}
/** Abbruch, nachdem schon Text vorgelesen wurde: kein anderes Modell mehr versuchen, sonst kommt die Antwort doppelt. */
class StreamError extends Error {}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Roher Aufruf: liefert den ersten Antwort-Kandidaten (Text, Funktionsaufrufe) unverändert zurück. */
async function geminiRaw(key: string, model: string, body: object, timeout = TIMEOUT) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(timeout),
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw geminiError(res, json);
  return json?.candidates?.[0] as { content?: ChatTurn; finishReason?: string } | undefined;
}

function geminiError(res: Response, json: { error?: { message?: string } } | null) {
  const msg = json?.error?.message ?? res.statusText;
  if (/api key/i.test(msg)) return new KeyError("Der Gemini-Schlüssel ist ungültig. Bitte neu eintragen.");
  return Object.assign(new Error(msg), { status: res.status });
}

type Part = Record<string, unknown>;

/**
 * Wie geminiRaw, aber gestreamt (Server-Sent Events): Text geht Stück für Stück an onText, sobald er da ist,
 * damit Jarvis den ersten Satz schon spricht, während der Rest noch entsteht. Liefert am Ende alle Teile
 * (Text zusammengefügt, Funktionsaufrufe und Gedanken-Signaturen unverändert).
 */
async function geminiStream(key: string, model: string, body: object, timeout: number, onText?: (t: string) => void) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    signal: AbortSignal.timeout(timeout),
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw geminiError(res, await res.json().catch(() => null));
  const parts: Part[] = [];
  let finish = "";
  let spoke = false;
  const take = (data: string) => {
    const json = JSON.parse(data);
    if (json.error) throw Object.assign(new Error(json.error.message ?? "Fehler im Stream"), { status: json.error.code });
    const cand = json.candidates?.[0];
    finish = cand?.finishReason ?? finish;
    for (const p of (cand?.content?.parts ?? []) as Part[]) {
      const last = parts.at(-1);
      // Textstücke zu einem Teil zusammenfügen; Signaturen und Gedanken bleiben an ihrem Teil
      if (typeof p.text === "string" && typeof last?.text === "string" && !p.thought && !last.thought && !last.thoughtSignature) {
        last.text += p.text;
        if (p.thoughtSignature) last.thoughtSignature = p.thoughtSignature;
      } else parts.push({ ...p });
      if (typeof p.text === "string" && p.text && !p.thought) {
        spoke = true;
        onText?.(p.text);
      }
    }
  };
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      const events = (buf + (value ?? "").replace(/\r/g, "")).split("\n\n");
      buf = done ? "" : events.pop()!; // angefangenes Ereignis aufheben
      for (const ev of events) {
        const data = ev.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
        if (data) take(data);
      }
      if (done) break;
    }
  } catch (e) {
    if (spoke && !(e instanceof KeyError)) throw new StreamError("Die Verbindung ist mitten in der Antwort abgerissen. Frag bitte nochmal.");
    throw e;
  }
  return { parts, finish };
}

/** schema: Gemini gibt garantiert gültiges JSON in dieser Form aus (Structured Output), sonst schreibt es manchmal
 * Zeilenumbrüche in Strings oder Listen ohne Anführungszeichen. */
type Opts = { json?: boolean; search?: boolean; schema?: z.ZodType };

async function geminiCall(key: string, model: string, msgs: Msg[], opts: Opts) {
  const contents = msgs.map((m) => ({
    role: m.role,
    parts: [...(m.pdf ? [{ inline_data: { mime_type: "application/pdf", data: m.pdf.base64 } }] : []), { text: m.text }],
  }));
  const cand = await geminiRaw(key, model, {
    contents,
    ...(opts.search && { tools: [{ google_search: {} }] }),
    generationConfig: {
      maxOutputTokens: 65536,
      ...(opts.json && { responseMimeType: "application/json" }),
      ...(opts.schema && { responseJsonSchema: z.toJSONSchema(opts.schema) }),
    },
  });
  const text = (cand?.content?.parts ?? []).map((p) => (typeof p.text === "string" ? p.text : "")).join("");
  if (!text) throw new Error(`keine Antwort (${cand?.finishReason ?? "leer"})`);
  return text;
}

async function openRouterCall(key: string, model: string, msgs: Msg[]) {
  const messages = await Promise.all(
    msgs.map(async (m) => ({
      role: m.role === "model" ? "assistant" : "user",
      content: m.pdf
        ? `Folientext (aus der PDF ausgelesen, Bilder fehlen):\n\n${(await m.pdf.slides()).map((s) => `--- Folie ${s.page} ---\n${s.text}`).join("\n")}\n\n${m.text}`
        : m.text,
    })),
  );
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages }),
  });
  const body = await res.json().catch(() => null);
  if (res.status === 401) throw new KeyError("Der OpenRouter-Schlüssel ist ungültig. Bitte neu eintragen.");
  if (!res.ok || body?.error) throw new Error(body?.error?.message ?? res.statusText);
  const text: string = body?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("keine Antwort");
  return text;
}

/** Probiert die Gemini-Modelle der Reihe nach. Ungültige Schlüssel brechen sofort ab, Überlast und leere Kontingente führen zum nächsten Modell. */
async function geminiChain<T, M extends { id: string; label: string }>(
  key: string,
  run: (model: string, m: M) => Promise<T>,
  errors: string[],
  models: M[] = GEMINI_MODELS as M[],
  retryWait = 3000,
): Promise<{ value: T; via: string } | null> {
  for (const m of models) {
    // Überlast (503) ist oft nach Sekunden vorbei: einmal kurz warten, dann nächstes Modell
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return { value: await run(m.id, m), via: m.label };
      } catch (e) {
        if (e instanceof KeyError || e instanceof StreamError) throw e;
        const status = (e as { status?: number }).status;
        if (attempt === 0 && (status === 503 || status === 500)) {
          await wait(retryWait);
          continue;
        }
        const why = status === 429 ? "Kontingent aufgebraucht" : status === 503 ? "überlastet" : status === 404 ? "nicht mehr verfügbar" : (e as Error).name === "TimeoutError" ? "keine Antwort (Zeitlimit)" : (e as Error).message;
        errors.push(`${m.label}: ${why}`);
        break;
      }
    }
  }
  return null;
}

const noModel = (errors: string[]) =>
  new Error(`Gerade ist kein Modell verfügbar. Später nochmal versuchen oder den Weg über claude.ai nehmen. (${errors.join(" · ")})`);

/** Probiert die Kette durch: erst Gemini, dann (ohne Websuche) OpenRouter. */
async function ask(msgs: Msg[], opts: Opts = {}): Promise<Reply> {
  const errors: string[] = [];
  const gKey = getGeminiKey();
  if (gKey) {
    const r = await geminiChain(gKey, (model) => geminiCall(gKey, model, msgs, opts), errors);
    if (r) return { text: r.value, via: r.via };
  }
  const oKey = getOpenRouterKey();
  if (oKey && !opts.search) {
    for (const m of OPENROUTER_MODELS) {
      try {
        return { text: await openRouterCall(oKey, m.id, msgs), via: m.label };
      } catch (e) {
        if (e instanceof KeyError) throw e;
        errors.push(`${m.label}: ${(e as Error).message}`);
      }
    }
  }
  if (!gKey && !oKey) throw new Error("Bitte zuerst einen Gemini- oder OpenRouter-Schlüssel eintragen.");
  throw noModel(errors);
}

/** Ein Chat-Teilnehmerbeitrag im Gemini-Format (Text, functionCall, functionResponse). */
export type ChatTurn = { role: "user" | "model"; parts: Record<string, unknown>[] };

/**
 * Ein Schritt im Sprachassistenten: Verlauf + Werkzeuge rein, Antwort des Modells (Text oder Funktionsaufrufe) raus.
 * Nur Gemini: Funktionsaufrufe brauchen ein verlässliches Modell. Für gesprochene Antworten auf Tempo getrimmt:
 * gestreamt (onText bekommt den Text sofort), wenig Nachdenken, kurzes Zeitlimit und schneller Wechsel bei Überlast.
 */
export async function chatTurn(
  contents: ChatTurn[],
  opts: { system: string; tools: object[]; onText?: (t: string) => void },
): Promise<{ content: ChatTurn; via: string }> {
  const key = getGeminiKey();
  if (!key) throw new Error("Bitte zuerst einen Gemini-Schlüssel eintragen.");
  const errors: string[] = [];
  const body = (thinkingLevel?: string) => ({
    contents,
    systemInstruction: { parts: [{ text: opts.system }] },
    tools: [{ functionDeclarations: opts.tools }],
    generationConfig: { maxOutputTokens: 8192, ...(thinkingLevel && { thinkingConfig: { thinkingLevel } }) },
  });
  const r = await geminiChain(
    key,
    async (model, m) => {
      let res;
      try {
        res = await geminiStream(key, model, body(m.thinking), 25_000, opts.onText);
      } catch (e) {
        // Älteres Modell ohne thinkingLevel (400): gleich nochmal ohne
        if ((e as { status?: number }).status !== 400 || !/thinking|level/i.test((e as Error).message)) throw e;
        res = await geminiStream(key, model, body(), 25_000, opts.onText);
      }
      if (!res.parts.length) throw new Error(`keine Antwort (${res.finish || "leer"})`);
      return { role: "model" as const, parts: res.parts };
    },
    errors,
    VOICE_MODELS,
    1000,
  );
  if (!r) throw new Error(`Gerade ist kein KI-Modell erreichbar. Gleich nochmal versuchen. (${errors.join(" · ")})`);
  return { content: r.value, via: r.via };
}

function toBase64(buf: ArrayBuffer) {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Erzeugt die drei Antworten (Rohtext) wie aus dem claude.ai-Chat; Prüfung und Speichern macht der Importer. via = Modellname. */
export async function generateLecture(
  file: File,
  prompts: { notes: string; study: string; parseNotes: (notesRaw: string) => Notes | null },
  onStep: (step: "notes" | "study" | "videos", raw: string, via: string) => void,
) {
  if (file.size > MAX_PDF) throw new Error("Die PDF ist grösser als 18 MB. Bitte verkleinern oder teilen.");
  let slides: Promise<SlideText[]> | null = null;
  const pdf = { base64: toBase64(await file.arrayBuffer()), slides: () => (slides ??= readPdf(file)) };

  const history: Msg[] = [{ role: "user", text: prompts.notes, pdf }];
  const notes = await ask(history, { json: true, schema: NotesSchema });
  onStep("notes", notes.text, notes.via);

  history.push({ role: "model", text: notes.text }, { role: "user", text: prompts.study });
  const study = await ask(history, { json: true, schema: StudySchema });
  onStep("study", study.text, study.via);

  // Videos sind optional: Fehler nicht weiterwerfen, Nachholen im Reiter „Videos“.
  const parsed = prompts.parseNotes(notes.text);
  if (parsed) {
    try {
      const v = await findVideos(parsed);
      onStep("videos", v.text, v.via);
    } catch {
      // bewusst still
    }
  }
}

/** Videos zur Vorlesung: über die YouTube-API (zuverlässig, keine erfundenen Links), sonst Prompt 3 mit Gemini-Suche. Rohtext für parseClaudeJson. */
export async function findVideos(notes: Pick<Notes, "title" | "course" | "sections">): Promise<Reply> {
  const yt = getYouTubeKey();
  if (!yt) return ask([{ role: "user", text: videosPrompt(notes) }], { search: true });

  // Abschnitte gleichmässig über die Vorlesung verteilt, je ein Video (wie im Prompt: 3, bei vielen Themen 5)
  const n = Math.min(notes.sections.length, notes.sections.length > 6 ? 5 : 3);
  const picks = Array.from({ length: n }, (_, i) => notes.sections[Math.round((i * (notes.sections.length - 1)) / Math.max(1, n - 1))]);
  const videos: Video[] = [];
  for (const s of picks) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    const params = { part: "snippet", type: "video", q: `${s.title} erklärt`, maxResults: "3", relevanceLanguage: "de", videoEmbeddable: "true", safeSearch: "strict", key: yt };
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg: string = body?.error?.message ?? res.statusText;
      if (/api key/i.test(msg)) throw new KeyError("Der YouTube-Schlüssel ist ungültig. Bitte neu eintragen.");
      throw new Error(res.status === 403 ? "YouTube-Tageskontingent aufgebraucht." : `YouTube: ${msg}`);
    }
    const hit = (body?.items ?? []).find((i: { id: { videoId: string } }) => !videos.some((v) => v.url.endsWith(i.id.videoId)));
    if (hit)
      videos.push({
        title: decodeHtml(hit.snippet.title),
        url: `https://www.youtube.com/watch?v=${hit.id.videoId}`,
        channel: decodeHtml(hit.snippet.channelTitle),
        topic: s.title,
        reason: "",
        language: "",
      });
  }
  return { text: JSON.stringify({ videos }), via: "YouTube" };
}

// YouTube liefert Titel HTML-kodiert ("&amp;", "&#39;")
const decodeHtml = (s: string) =>
  s.replace(/&(amp|quot|lt|gt|#39);/g, (_, e) => ({ amp: "&", quot: '"', lt: "<", gt: ">", "#39": "'" })[e as string]!);

/** KI-Korrektur einer offenen Quizantwort gegen die Musterlösung. */
export async function gradeAnswer(q: QuizQuestion, answer: string) {
  const reply = await ask([{ role: "user", text: gradePrompt(q, answer) }], { json: true, schema: GradeSchema });
  const parsed = parseClaudeJson(reply.text, GradeSchema);
  if (!parsed.ok) throw new Error("Die Korrektur kam unvollständig zurück. Bitte nochmal prüfen.");
  return parsed.data;
}
