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

  // Sprachassistent: Funktionsaufruf samt Signatur unverändert zurück, Werkzeuge und Systemtext gehen mit
  const { chatTurn } = await import("../src/lib/gemini");
  let sent: { systemInstruction?: unknown; tools?: unknown } = {};
  globalThis.fetch = (async (_: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    const parts = [{ functionCall: { name: "x", args: {} }, thoughtSignature: "sig" }];
    return new Response(`data: ${JSON.stringify({ candidates: [{ content: { role: "model", parts } }] })}\n\n`, { status: 200 });
  }) as typeof fetch;
  const t = await chatTurn([{ role: "user", parts: [{ text: "hi" }] }], { system: "S", tools: [{ name: "x" }] });
  assert.deepEqual(t.content.parts[0], { functionCall: { name: "x", args: {} }, thoughtSignature: "sig" });
  assert.deepEqual(sent.systemInstruction, { parts: [{ text: "S" }] });
  assert.deepEqual(sent.tools, [{ functionDeclarations: [{ name: "x" }] }]);

  // Sprachkette: Modell ohne thinkingLevel (400) → gleich nochmal ohne, kein Modellwechsel
  const tried: string[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body));
    tried.push(`${url.split("/models/")[1].split(":")[0]}:${b.generationConfig.thinkingConfig?.thinkingLevel ?? "-"}`);
    if (b.generationConfig.thinkingConfig) return new Response(JSON.stringify({ error: { message: "thinking_level is not supported" } }), { status: 400 });
    return new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] })}\n\n`, { status: 200 });
  }) as typeof fetch;
  const t2 = await chatTurn([{ role: "user", parts: [{ text: "hi" }] }], { system: "S", tools: [] });
  assert.equal(t2.via, "Gemini 3.6 Flash");
  assert.deepEqual(tried, ["gemini-3.6-flash:low", "gemini-3.6-flash:-"]);

  // Abriss mitten in der Antwort: nicht beim nächsten Modell nochmal anfangen (sonst doppelt vorgelesen)
  tried.length = 0;
  globalThis.fetch = (async (url: string) => {
    tried.push(url);
    const enc = new TextEncoder();
    const body = new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hallo" }] } }] })}\n\n`));
      },
      pull(c) {
        if (!c.desiredSize) return; // erst abreissen, wenn das erste Stück gelesen ist
        c.error(new Error("reset"));
      },
    });
    return new Response(body, { status: 200 });
  }) as typeof fetch;
  await assert.rejects(chatTurn([{ role: "user", parts: [{ text: "hi" }] }], { system: "S", tools: [] }), /abgerissen/);
  assert.equal(tried.length, 1);

  console.log("gemini: alles ok");
})();
