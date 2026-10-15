// Selbsttest Ausweichkette (ohne echte Schlüssel, fetch wird simuliert): npx tsx scripts/gemini-check.ts
import assert from "node:assert";

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
});
let calls: string[] = [];
let respond: (url: string) => { status: number; body: unknown };
globalThis.fetch = (async (input: string | URL) => {
  const url = String(input);
  calls.push(url);
  const r = respond(url);
  return new Response(JSON.stringify(r.body), { status: r.status });
}) as typeof fetch;
const ok = (text: string) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] } }] } });

(async () => {
  const { findVideos, setGeminiKey, setOpenRouterKey, setYouTubeKey } = await import("../src/lib/gemini");
  setGeminiKey("g");
  const sec = (title: string) => ({ title, slides: "", content: "", key_points: [], exam_hint: "" });
  const p = { title: "T", course: "C", sections: [sec("A"), sec("B"), sec("C")] };

  // Erstes Modell überlastet (auch nach neuem Versuch), zweites verschwunden (404) → das langsame neueste Modell als letztes
  calls = [];
  respond = (u) =>
    u.includes("3.5-flash")
      ? { status: 503, body: { error: { message: "high demand" } } }
      : u.includes("flash-lite-latest")
        ? { status: 404, body: { error: { message: "no longer available" } } }
        : ok("{}");
  const r = await findVideos(p);
  assert.equal(r.via, "Gemini Flash (neuestes)");
  assert.equal(calls.filter((c) => c.includes("3.5-flash")).length, 2);
  assert.equal(calls.filter((c) => c.includes("flash-lite-latest")).length, 1);

  // Ungültiger Schlüssel: sofort abbrechen, kein weiteres Modell
  calls = [];
  respond = () => ({ status: 400, body: { error: { message: "API key not valid." } } });
  await assert.rejects(findVideos(p), /Gemini-Schlüssel ist ungültig/);
  assert.equal(calls.length, 1);

  // Alles aufgebraucht: verständliche Sammelmeldung; Videosuche geht nie an OpenRouter (keine Websuche)
  setOpenRouterKey("o");
  calls = [];
  respond = () => ({ status: 429, body: { error: { message: "quota" } } });
  await assert.rejects(findVideos(p), /kein Modell verfügbar.*Kontingent aufgebraucht/);
  assert.ok(calls.every((c) => !c.includes("openrouter")));

  // Mit YouTube-Schlüssel: nur YouTube, ein Video pro Thema, kein Video doppelt, Titel dekodiert
  setYouTubeKey("y");
  calls = [];
  const item = (id: string) => ({ id: { videoId: id }, snippet: { title: "Km &amp; Vmax &#39;erklärt&#39;", channelTitle: "Kanal" } });
  respond = () => ({ status: 200, body: { items: [item("aaaaaaaaaaa"), item("bbbbbbbbbbb"), item("ccccccccccc")] } });
  const y = JSON.parse((await findVideos(p)).text).videos as { url: string; title: string; topic: string }[];
  assert.deepEqual(y.map((v) => v.url.slice(-11)), ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]);
  assert.deepEqual(y.map((v) => v.topic), ["A", "B", "C"]);
  assert.equal(y[0].title, "Km & Vmax 'erklärt'");
  assert.ok(calls.every((c) => c.includes("youtube")));

  console.log("gemini: alles ok");
})();
