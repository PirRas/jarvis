// Echter Test der Folien-Aufbereitung pro Modell (echte Gemini-API, GEMINI_API_KEY nötig): npx tsx scripts/lecture-check.ts "<pfad.pdf>" [modell ...]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
});

const [pdfPath, ...modelArgs] = process.argv.slice(2);
const key = process.env.GEMINI_API_KEY;
if (!pdfPath) {
  console.error('Aufruf: npx tsx scripts/lecture-check.ts "<pfad.pdf>" [modell ...]');
  process.exit(1);
}
if (!key) {
  console.error("Umgebungsvariable GEMINI_API_KEY fehlt.");
  process.exit(1);
}
const models = modelArgs.length ? modelArgs : ["gemini-3.5-flash", "gemini-flash-lite-latest"];

const realFetch = globalThis.fetch;
let model = "";
let finish: string[] = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  let url = String(input instanceof Request ? input.url : input);
  if (!url.includes("generativelanguage.googleapis.com")) return realFetch(input, init);
  // Videosuche (google_search) überspringen, spart Kontingent
  if (String(init?.body).includes("google_search")) return new Response(JSON.stringify({ error: { message: "übersprungen" } }), { status: 429 });
  url = url.replace(/\/models\/[^:/]+:/, `/models/${model}:`);
  const res = await realFetch(url, init);
  const json = await res.clone().json().catch(() => null);
  finish.push(json?.candidates?.[0]?.finishReason ?? `HTTP ${res.status}`);
  return res;
}) as typeof fetch;

(async () => {
  const { generateLecture, setGeminiKey } = await import("../src/lib/gemini");
  const { notesPrompt, STUDY_PROMPT } = await import("../src/lib/prompts");
  const { NotesSchema, StudySchema, parseClaudeJson } = await import("../src/lib/schema");
  setGeminiKey(key);
  const file = new File([readFileSync(pdfPath)], basename(pdfPath), { type: "application/pdf" });
  const dir = join(tmpdir(), "lecture-check");
  mkdirSync(dir, { recursive: true });
  // Kein "via": fetch schreibt alle Kettenmodelle auf das erzwungene um, die Kette meldet also immer ihr erstes Modell
  const rows: string[][] = [["Modell", "Schritt", "Dauer s", "Zeichen", "Schema", "Anzahl", "finishReason"]];

  for (const m of models) {
    model = m;
    finish = [];
    let t = Date.now();
    let steps = 0;
    console.log(`\n== ${m} ==`);
    try {
      await generateLecture(
        file,
        { notes: notesPrompt([]), study: STUDY_PROMPT, parseNotes: (raw) => { const p = parseClaudeJson(raw, NotesSchema); return p.ok ? p.data : null; } },
        (step, raw) => {
          if (step === "videos") return;
          const secs = ((Date.now() - t) / 1000).toFixed(1);
          t = Date.now();
          const file = join(dir, `${m}-${step}.json`);
          writeFileSync(file, raw);
          let schema = "ok";
          let count = "";
          if (step === "notes") {
            const p = parseClaudeJson(raw, NotesSchema);
            if (p.ok) count = `${p.data.sections.length} Abschnitte`;
            else schema = p.error;
          } else {
            const p = parseClaudeJson(raw, StudySchema);
            if (p.ok) count = `${p.data.flashcards.length} Karten, ${p.data.quiz.length} Fragen`;
            else schema = p.error;
          }
          if (schema !== "ok") schema = `FEHLER: ${schema} | Ende: …${raw.slice(-200)}`;
          console.log(`${step}: ${secs} s, ${raw.length} Zeichen, ${schema}${count ? `, ${count}` : ""}, finishReason ${finish[steps]}\n  Rohantwort: ${file}`);
          rows.push([m, step, secs, String(raw.length), schema === "ok" ? "ok" : "FEHLER", count || "-", finish[steps] ?? "?"]);
          steps++;
        },
      );
    } catch (e) {
      console.log(`Fehler: ${(e as Error).message}`);
      rows.push([m, steps ? "study" : "notes", ((Date.now() - t) / 1000).toFixed(1), "-", "-", "-", finish[steps] ?? "?"]);
      process.exitCode = 1;
    }
  }

  console.log("\n" + rows.map((r) => r.join(" | ")).join("\n"));
})();
