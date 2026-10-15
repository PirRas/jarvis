"use client";

// Automatische Aufbereitung mit Googles kostenlosem Gemini-Kontingent (Schlüssel aus aistudio.google.com).
// Läuft direkt im Browser: kein Server-Zeitlimit, keine Upload-Grenze von Vercel, der Schlüssel bleibt auf dem Gerät.
// Ablauf wie im claude.ai-Chat: PDF + Prompt 1, dann Prompt 2 im selben Verlauf, dann Prompt 3 mit Google-Suche.

const KEY = "gemini-key";
const MODEL = "gemini-flash-latest"; // Alias auf das aktuelle Flash-Modell, überlebt Modellwechsel
const MAX_PDF = 18 * 1024 * 1024; // shortcut: PDF geht inline mit (Grenze ~20 MB), bei grösseren Dateien Files-API einbauen

export const getGeminiKey = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
export const setGeminiKey = (k: string) => {
  try {
    localStorage.setItem(KEY, k.trim());
  } catch {
    // Speicher nicht verfügbar: Schlüssel gilt nur bis zum Neuladen.
  }
};

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
type Turn = { role: "user" | "model"; parts: Part[] };

async function ask(key: string, contents: Turn[], opts: { json?: boolean; search?: boolean } = {}) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents,
      ...(opts.search && { tools: [{ google_search: {} }] }),
      generationConfig: { maxOutputTokens: 65536, ...(opts.json && { responseMimeType: "application/json" }) },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg: string = body?.error?.message ?? res.statusText;
    if (res.status === 429) throw new Error("Tageskontingent von Gemini erreicht. Morgen wieder oder den Weg über claude.ai nehmen.");
    if (/api key/i.test(msg)) throw new Error("Der Gemini-Schlüssel ist ungültig. Bitte neu eintragen.");
    throw new Error(`Gemini: ${msg}`);
  }
  const cand = body?.candidates?.[0];
  const text: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error(`Gemini hat nichts geliefert (${cand?.finishReason ?? "keine Antwort"}).`);
  return text;
}

function toBase64(buf: ArrayBuffer) {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Erzeugt die drei Antworten (Rohtext) wie aus dem claude.ai-Chat; Prüfung und Speichern macht der Importer. */
export async function generateLecture(
  key: string,
  file: File,
  prompts: { notes: string; study: string; videos: (notesRaw: string) => string | null },
  onStep: (step: "notes" | "study" | "videos", raw: string) => void,
) {
  if (file.size > MAX_PDF) throw new Error("Die PDF ist grösser als 18 MB. Bitte verkleinern oder teilen.");
  const pdf: Part = { inline_data: { mime_type: "application/pdf", data: toBase64(await file.arrayBuffer()) } };

  const history: Turn[] = [{ role: "user", parts: [pdf, { text: prompts.notes }] }];
  const notes = await ask(key, history, { json: true });
  onStep("notes", notes);

  history.push({ role: "model", parts: [{ text: notes }] }, { role: "user", parts: [{ text: prompts.study }] });
  onStep("study", await ask(key, history, { json: true }));

  // Videos sind optional: Fehler hier nicht weiterwerfen, sie lassen sich im Reiter „Videos“ nachholen.
  const videosPrompt = prompts.videos(notes);
  if (videosPrompt) {
    try {
      onStep("videos", await findVideos(key, videosPrompt));
    } catch {
      // bewusst still
    }
  }
}

/** Prompt 3 mit Google-Suche, ohne PDF (spart Kontingent, die Themen stehen im Prompt). Liefert Rohtext für parseClaudeJson. */
export const findVideos = (key: string, prompt: string) => ask(key, [{ role: "user", parts: [{ text: prompt }] }], { search: true });
