// Selbsttest Nachbereitungsplan: npx tsx scripts/prep-check.ts
import assert from "node:assert";
import type { Mark } from "../src/lib/assistant";
import { addDays, atTime, DAYMS, isoWeekday, MIN, occurrences, parseIsoDate, type CalEvent, type PlannerData, type Slot } from "../src/lib/planner";
import { alternatives, doneId, pinMark, postponed, prepPlan, prepSettingsMark, DEFAULT_PREP, snapshot } from "../src/lib/prepPlan";
import { runTool, type ToolContext, type ToolStore } from "../src/lib/voiceTools";

const slot = (id: string, course: string, weekday: number, start: string, end: string, type = "Vorlesung"): Slot => ({
  id,
  course,
  type,
  weekday,
  start,
  end,
  room: "",
  from: "2026-09-14",
  until: "2026-12-18",
  createdAt: 0,
});
const slots = [
  slot("ana", "Anatomie", 1, "10:15", "12:00"),
  slot("che", "Chemie", 2, "08:15", "10:00"),
  slot("phy", "Physik", 2, "14:15", "16:00"),
  slot("uebung", "Chemie Übung", 3, "13:15", "15:00", "Übung"),
  slot("bio", "Biologie", 5, "10:15", "12:00"),
];
const now = new Date(2026, 9, 16, 9, 0).getTime(); // Freitag
const data: PlannerData = { slots, events: [], feeds: [], caches: [], todos: [] };

const plan = prepPlan(data, [], [], now);
// 5 Wochen à 4 Vorlesungen (Übung zählt nicht); Freitag 16.10. ist noch nicht vorbei
assert.equal(plan.backlog.length, 4 * 5 - 1, `Rückstand ${plan.backlog.length}`);
assert.equal(plan.weeks.length, 5);
assert.ok(plan.catchUp && plan.catchUp > now, "Aufholdatum");

// Einheiten: nie über einem Termin, nur im Zeitfenster, Tagesmaximum eingehalten, keine Überschneidung untereinander
const busy = occurrences(data, addDays(now, -1), addDays(now, 130));
const perDay = new Map<number, number>();
for (const s of plan.sessions) {
  assert.ok(!busy.some((b) => b.start < s.end + 15 * MIN && s.start < b.end + 15 * MIN), `Einheit über Termin: ${new Date(s.start)}`);
  const day = new Date(s.start);
  day.setHours(0, 0, 0, 0);
  const we = isoWeekday(s.start) >= 6;
  const win = we ? DEFAULT_PREP.weekend : DEFAULT_PREP.weekday;
  assert.ok(s.start >= atTime(day.getTime(), win.from) && s.end <= atTime(day.getTime(), win.to), "Zeitfenster");
  perDay.set(day.getTime(), (perDay.get(day.getTime()) ?? 0) + 60);
  assert.ok(perDay.get(day.getTime())! <= win.max, "Tagesmaximum");
  assert.ok(s.start >= s.lesson.end, "Einheit vor der Vorlesung");
}
for (let i = 1; i < plan.sessions.length; i++) assert.ok(plan.sessions[i].start >= plan.sessions[i - 1].end, "Überschneidung");

// Heute (Freitag) Biologie: Einheit am selben Tag nach der Vorlesung
const bioToday = plan.sessions.find((s) => s.lesson.key === "slot:bio:2026-10-16");
assert.ok(bioToday, "Biologie von heute geplant");
assert.equal(new Date(bioToday.start).getDate(), 16);
// Die älteste offene Vorlesung kommt zuerst dran (nach den frischen)
assert.equal(plan.sessions[0].lesson.key, "slot:bio:2026-10-16");
assert.equal(plan.sessions[1].lesson.key, "slot:ana:2026-09-14");

// Neuer Termin am Nachmittag verschiebt die Einheiten, mit Begründung und Vorschlägen
const seen = snapshot(plan, now);
const first = plan.sessions[1];
const block: CalEvent = {
  id: "zahnarzt",
  title: "Zahnarzt",
  course: "",
  kind: "other",
  start: first.start,
  end: first.end,
  allDay: false,
  location: "",
  note: "",
  source: "manual",
  createdAt: now,
};
const data2 = { ...data, events: [block] };
const plan2 = prepPlan(data2, [], [], now);
const moved = postponed(seen, plan2, data2, now);
assert.ok(moved.length >= 1);
assert.equal(moved[0].lesson.key, first.lesson.key);
assert.equal(moved[0].cause, "wegen „Zahnarzt“");
assert.ok(moved[0].session!.start > first.start);
const alts = alternatives(data2, plan2, first.lesson, now);
assert.equal(alts.length, 3);
assert.equal(new Set(alts.map((t) => new Date(t).getDate())).size, 3, "Vorschläge an verschiedenen Tagen");

// Erledigt und fest gelegte Zeit
const marks: Mark[] = [{ id: doneId("slot:ana:2026-09-14"), createdAt: now }, pinMark("slot:che:2026-09-15", alts[2])];
const plan3 = prepPlan(data2, [], marks, now);
assert.equal(plan3.backlog.length, plan.backlog.length - 1);
const pinned = plan3.sessions.find((s) => s.lesson.key === "slot:che:2026-09-15")!;
assert.equal(pinned.start, alts[2]);
assert.equal(pinned.pinned, true);
// Erledigen verschiebt nichts nach hinten, also keine Meldung
assert.equal(postponed(snapshot(plan2, now), prepPlan(data2, [], [marks[0]], now), data2, now).length, 0);

// Verpasst: eine Stunde nach der Einheit ist sie neu geplant und wird gemeldet
const later = bioToday.end + 60 * MIN;
const missed = postponed(seen, prepPlan(data, [], [], later), data, later).find((m) => m.lesson.key === bioToday.lesson.key);
assert.equal(missed?.cause, "nicht erledigt");

// Ohne Wochenende und mit weniger Zeit dauert es länger
const slow = prepPlan(data, [], [prepSettingsMark({ ...DEFAULT_PREP, weekday: { ...DEFAULT_PREP.weekday, max: 60 }, weekend: { ...DEFAULT_PREP.weekend, on: false } })], now);
assert.ok(slow.sessions.every((s) => isoWeekday(s.start) < 6));
assert.ok(!slow.catchUp || slow.catchUp > plan.catchUp!, "langsamer");
// Aus: keine Einheiten
assert.equal(prepPlan(data, [], [prepSettingsMark({ ...DEFAULT_PREP, on: false })], now).sessions.length, 0);

// ---------- Sprachwerkzeuge ----------
const db: Record<string, { id: string }[]> = { slots: [...slots] };
const store: ToolStore = {
  list: async (s) => [...(db[s] ?? [])] as never,
  put: async (s, v) => {
    const list = (db[s] ??= []);
    const i = list.findIndex((x) => x.id === (v as { id: string }).id);
    if (i >= 0) list[i] = v as { id: string };
    else list.push(v as { id: string });
  },
  remove: async (s, ids) => {
    db[s] = (db[s] ?? []).filter((x) => !ids.includes(x.id));
  },
  lectures: async () => [],
  cards: async () => [],
  newLeft: async () => 20,
  feedCaches: async () => [],
};
const ctx: ToolContext = { store, now, navigate: () => {}, openUrl: () => {}, startFocus: () => {} };
const run = (name: string, args: Record<string, unknown> = {}) => runTool(name, args, ctx);

async function main() {
  const p = await run("nachbereitung_plan");
  assert.equal(p.rueckstand, 19, JSON.stringify(p).slice(0, 300));
  const einheiten = p.einheiten as { wann: string; vorlesung: string }[];
  assert.ok(einheiten.length > 5);

  // "Heute Nachmittag habe ich keine Zeit": Sperre im Kalender, Einheiten rutschen, mit Vorschlägen
  const k = await run("keine_zeit", { datum: "2026-10-16", von: "12:00", bis: "20:00", grund: "Arbeit" });
  assert.equal(k.ok, true, JSON.stringify(k));
  const v = k.nachbereitung_verschoben as { vorher: string; neu: string; vorschlaege: string[] }[];
  assert.ok(v?.length >= 1, JSON.stringify(k));
  assert.ok(v.every((x) => !x.neu.startsWith("Fr., 16. Okt.")), JSON.stringify(v));
  assert.ok(v[0].vorschlaege.length >= 1);
  const list = await run("termine_auflisten", { von: "2026-10-16" });
  const titles = (list.termine as { titel: string }[]).map((r) => r.titel);
  assert.ok(titles.includes("Keine Zeit: Arbeit"));
  assert.ok(!titles.some((t) => t.startsWith("Nachbereitung")), JSON.stringify(titles));
  assert.ok((await run("termin_aendern", { id: "prep:slot:ana:2026-09-14", titel: "x" })).fehler);

  // Termin anlegen meldet Überschneidung mit dem Stundenplan
  const t = await run("termin_anlegen", { titel: "Coiffeur", datum: "2026-10-19", beginn: "11:00", ende: "12:00" });
  assert.ok((t.ueberschneidungen as string[])?.[0]?.startsWith("Anatomie"), JSON.stringify(t));

  // Abhaken
  const e = await run("nachbereitung_erledigt", { fach: "Anatomie" });
  assert.equal(e.abgehakt, "Anatomie vom Mo., 14. Sept.", JSON.stringify(e));
  const all = await run("nachbereitung_erledigt", { fach: "Chemie", alle_bis: "2026-09-30" });
  assert.equal(all.abgehakt, 3, JSON.stringify(all));
  assert.equal((await run("nachbereitung_plan")).rueckstand, 15);

  // Verschieben: Vorschläge, dann feste Zeit, dann wieder automatisch
  const vor = await run("nachbereitung_verschieben", { fach: "Physik" });
  assert.ok((vor.vorschlaege as string[]).length >= 1, JSON.stringify(vor));
  const fest = await run("nachbereitung_verschieben", { fach: "Physik", datum: "2026-09-15", neues_datum: "2026-10-18", beginn: "15:00" });
  assert.equal(fest.ok, true, JSON.stringify(fest));
  assert.ok((await run("nachbereitung_verschieben", { fach: "Physik", neues_datum: "2026-10-19", beginn: "10:30" })).fehler, "über Anatomie");
  const auto = await run("nachbereitung_verschieben", { fach: "Physik", datum: "2026-09-15", automatisch: true });
  assert.equal(auto.ok, true);

  // Lernzeiten
  const lz = await run("lernzeiten_einstellen", { wochenende: false, werktags_bis: "18:00" });
  assert.equal(lz.ok, true, JSON.stringify(lz));
  assert.ok((await run("lernzeiten_einstellen", { werktags_von: "19:00", werktags_bis: "18:00" })).fehler);

  // Gedächtnis
  assert.equal((await run("merken", { fakt: "Arbeitet freitags bis 21 Uhr" })).ok, true);
  assert.equal((await run("merken", { fakt: "Lernt lieber am Abend" })).anzahl, 2);
  assert.equal((await run("vergessen", { fakt: "freitags" })).vergessen, 1);
  assert.ok((await run("vergessen", { fakt: "gibtsnicht" })).fehler);

  const day = parseIsoDate("2026-10-16");
  assert.ok(day + DAYMS > now);
  console.log("prep-check ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
