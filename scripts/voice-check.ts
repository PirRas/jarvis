// Selbsttest Sprachwerkzeuge: npx tsx scripts/voice-check.ts
import assert from "node:assert";
import { dbStore, runTool, systemPrompt, TOOL_DECLARATIONS, type ToolContext, type ToolStore } from "../src/lib/voiceTools";

// Speicher im Arbeitsspeicher statt IndexedDB
const data: Record<string, { id: string }[]> = {};
const store: ToolStore = {
  list: async (s) => [...(data[s] ?? [])] as never,
  put: async (s, v) => {
    const list = (data[s] ??= []);
    const i = list.findIndex((x) => x.id === (v as { id: string }).id);
    if (i >= 0) list[i] = v as { id: string };
    else list.push(v as { id: string });
  },
  remove: async (s, ids) => {
    data[s] = (data[s] ?? []).filter((x) => !ids.includes(x.id));
  },
  lectures: async () => [],
  cards: async () => [],
  newLeft: async () => 20,
  feedCaches: async () => [],
};

const now = new Date(2026, 9, 15, 9, 30).getTime();
const calls: string[] = [];
const ctx: ToolContext = {
  store,
  now,
  navigate: (p) => calls.push(`navigate:${p}`),
  openUrl: (u) => calls.push(`open:${u}`),
  startFocus: (c, m) => calls.push(`focus:${c}:${m}`),
};
const run = (name: string, args: Record<string, unknown> = {}) => runTool(name, args, ctx);
type Row = Record<string, unknown>;

async function main() {
  assert.ok(typeof dbStore.list === "function" && systemPrompt(now).includes("2026-10-15"));

  // Termin: anlegen, auflisten, ändern, löschen
  const made = await run("termin_anlegen", { titel: "Prüfung Chemie", datum: "2026-10-20", beginn: "10:15" });
  assert.equal(made.ok, true, JSON.stringify(made));
  const t = made.termin as Row;
  assert.equal(t.art, "Prüfung");
  assert.equal(t.zeit, "10:15–11:15");
  assert.equal(t.aenderbar, true);
  const allDay = (await run("termin_anlegen", { titel: "Abgabe Bericht", datum: "2026-10-21" })).termin as Row;
  assert.equal(allDay.zeit, "ganztägig");
  let list = await run("termine_auflisten", { von: "2026-10-20", bis: "2026-10-21" });
  assert.equal(list.anzahl, 2);
  assert.equal((await run("termine_auflisten", { von: "2026-10-20", art: "exam" })).anzahl, 1);
  const changed = await run("termin_aendern", { id: String(t.id).replace("event:", ""), datum: "2026-10-22", ende: "12:00" });
  assert.equal((changed.termin as Row).zeit, "10:15–12:00", JSON.stringify(changed));
  assert.equal((changed.termin as Row).datum, "Do., 22. Okt.");
  assert.equal((await run("termin_loeschen", { id: t.id })).ok, true);
  list = await run("termine_auflisten", { von: "2026-10-20", bis: "2026-10-25" });
  assert.equal(list.anzahl, 1);

  // Aufgabe: anlegen, abhaken, löschen
  const todo = (await run("aufgabe_anlegen", { titel: "Skript lesen", faellig: "2026-10-16" })).aufgabe as Row;
  assert.equal(todo.faellig, "Fr., 16. Okt. (morgen)");
  assert.equal((await run("aufgaben_auflisten")).anzahl, 1);
  const done = (await run("aufgabe_aendern", { id: todo.id, erledigt: true })).aufgabe as Row;
  assert.equal(done.erledigt, true);
  assert.equal((await run("aufgaben_auflisten")).anzahl, 0);
  assert.equal((await run("aufgaben_auflisten", { filter: "erledigt" })).anzahl, 1);
  assert.equal((data.todos[0] as { doneAt?: number }).doneAt, now);
  assert.equal((await run("aufgabe_loeschen", { id: todo.id })).ok, true);
  assert.equal(data.todos.length, 0);

  // Lernzeit
  assert.equal((await run("lernzeit_eintragen", { fach: "Chemie", minuten: 45 })).ok, true);
  assert.equal((await run("lernzeit_eintragen", { fach: "Physik", minuten: 30, datum: "2026-10-13" })).ok, true);
  const sum = await run("lernzeit_auswerten", {});
  assert.equal(sum.minuten_gesamt, 75);
  assert.equal((sum.pro_fach as Row[])[0].fach, "Chemie");
  assert.equal((await run("lernzeit_auswerten", { tage: 1 })).minuten_gesamt, 45);

  // Noten
  assert.ok((await run("note_eintragen", { kurs: "Mathematik", note: 7 })).fehler);
  assert.ok((await run("note_eintragen", { kurs: "zzzzzz", note: 5 })).fehler);

  // Fehlerfälle
  assert.ok(String((await run("termin_anlegen", { titel: "X", datum: "morgen" })).fehler).includes("Datum"));
  assert.ok((await run("termin_anlegen", { titel: "X", datum: "2026-02-31" })).fehler);
  assert.ok((await run("termin_anlegen", { titel: "X", datum: "2026-10-20", beginn: "25:00" })).fehler);
  assert.ok((await run("termin_loeschen", { id: "gibt-es-nicht" })).fehler);
  assert.ok((await run("aufgabe_aendern", { id: "gibt-es-nicht" })).fehler);
  const slot = { id: "s1", course: "Chemie", type: "Vorlesung", weekday: 1, start: "08:15", end: "10:00", room: "", from: "2026-09-14", until: "2026-12-18", createdAt: 1 };
  data.slots = [slot];
  const monday = (await run("termine_auflisten", { von: "2026-10-19" })).termine as Row[];
  assert.equal(monday[0].aenderbar, false);
  assert.ok(String((await run("termin_aendern", { id: monday[0].id, titel: "X" })).fehler).includes("Stundenplan"));
  assert.ok((await run("termin_loeschen", { id: monday[0].id })).fehler);
  assert.equal(data.slots.length, 1);

  // Navigation, Links, Fokus
  assert.equal((await run("seite_oeffnen", { seite: "/aufgaben" })).ok, true);
  assert.deepEqual(calls, ["navigate:/aufgaben"]);
  assert.ok((await run("seite_oeffnen", { seite: "/nix" })).fehler);
  data.links = [{ id: "l1", name: "ADAM", url: "https://adam.unibas.ch", group: "Jeden Tag", order: 0 } as { id: string }];
  assert.equal((await run("link_oeffnen", { name: "adam" })).ok, true);
  assert.ok((await run("link_oeffnen", { name: "nix" })).fehler);
  assert.equal(calls.at(-1), "open:https://adam.unibas.ch");
  await run("fokus_starten", { fach: "Chemie", minuten: 25 });
  assert.equal(calls.at(-1), "focus:Chemie:25");

  // Jedes deklarierte Werkzeug läuft (ohne "unbekannt")
  for (const d of TOOL_DECLARATIONS) {
    const r = await run(d.name, { von: "2026-10-15", id: "x", seite: "/", name: "ADAM", fach: "x", minuten: 1, titel: "x", datum: "2026-10-15", kurs: "x" });
    assert.ok(!String(r.fehler ?? "").includes("Unbekanntes Werkzeug"), d.name);
  }
  assert.ok((await run("gibts_nicht")).fehler);

  // Ganze Runde mit simuliertem Gemini: Funktionsaufruf → Werkzeug → gesprochene Antwort
  const ls = new Map([["gemini-key", "g"]]);
  Object.assign(globalThis, { localStorage: { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => void ls.set(k, v) } });
  const bodies: { contents: { role: string; parts: Row[] }[] }[] = [];
  const answers = [
    [{ functionCall: { name: "aufgabe_anlegen", args: { titel: "Skript drucken", faellig: "2026-10-16" } }, thoughtSignature: "s1" }],
    [{ text: "Erledigt, Skript drucken steht für morgen auf der Liste." }],
  ];
  globalThis.fetch = (async (_: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: answers[bodies.length - 1] } }] }), { status: 200 });
  }) as typeof fetch;
  const { askJarvis } = await import("../src/lib/jarvisAgent");
  const before = (data.todos ?? []).length;
  const r = await askJarvis("Erinner mich morgen ans Skript drucken", [], ctx);
  assert.equal(r.reply, "Erledigt, Skript drucken steht für morgen auf der Liste.");
  assert.deepEqual(r.actions, ["aufgabe_anlegen"]);
  assert.equal(data.todos.length, before + 1);
  // Zweite Anfrage: Modellantwort samt Signatur und Werkzeug-Ergebnis gehen mit
  const second = bodies[1].contents;
  assert.equal(second[1].parts[0].thoughtSignature, "s1");
  assert.equal((second[2].parts[0].functionResponse as Row).name, "aufgabe_anlegen");
  assert.equal(r.history.length, 4);

  console.log("voiceTools: alles ok");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
