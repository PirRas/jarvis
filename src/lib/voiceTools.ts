// Sprachassistent: die "Hände" von Jarvis. Gemini ruft diese Werkzeuge per Function Calling auf;
// hier stehen die Deklarationen und die Ausführung. Die Datensätze entstehen genauso wie in der App.

import type { CourseRecord, Mark, StudySession, Todo } from "./assistant";
import { matchExistingCourse, sameCourse } from "./courses";
import {
  allCards,
  allFeedCaches,
  deleteItems,
  getSettings,
  listItems,
  listLectures,
  newCardsLeftToday,
  putItem,
  type Lecture,
  type PlannerStore,
  type PlannerValue,
} from "./db";
import { greeting, readiness, tips } from "./jarvis";
import {
  addDays,
  atTime,
  dayStart,
  DAYMS,
  EMPTY_PLANNER,
  fmtShortDay,
  fmtTime,
  guessKind,
  HOUR,
  isoDate,
  KIND_LABEL,
  knownCourses,
  MIN,
  nowAndNext,
  occurrences,
  parseIsoDate,
  relTime,
  type CalEvent,
  type EventKind,
  type FeedCache,
  type Occurrence,
  type PlannerData,
} from "./planner";
import { liteLectures } from "./lernplan";
import {
  alternatives,
  doneId,
  DEFAULT_PREP,
  pinMark,
  postponed,
  prepPlan,
  prepSettingsMark,
  readPrepSettings,
  snapshot,
  validWindow,
  type PrepPlan,
} from "./prepPlan";
import { countDue, type CardState } from "./srs";
import { PLAN, summarize, TOTAL_KP, validGrade, type PlanCourse, type Result } from "./studyPlan";
import { dueLabel, groupTodos, TODO_CATEGORIES } from "./todos";

export type ToolStore = {
  list<S extends PlannerStore>(store: S): Promise<PlannerValue<S>[]>;
  put<S extends PlannerStore>(store: S, value: PlannerValue<S>): Promise<void>;
  remove(store: PlannerStore, ids: string[]): Promise<void>;
  lectures(): Promise<Lecture[]>;
  cards(): Promise<CardState[]>;
  newLeft(): Promise<number>;
  feedCaches(): Promise<FeedCache[]>;
};

export type ToolContext = {
  store: ToolStore;
  now: number;
  navigate: (path: string) => void;
  openUrl: (url: string) => void;
  startFocus: (course: string, minutes: number) => void;
  name?: string; // Vorname aus dem Konto, für die Anrede
};

type Args = Record<string, unknown>;

// ---------- Deklarationen (Gemini functionDeclarations) ----------

const S = (description: string, extra: object = {}) => ({ type: "string", description, ...extra });
const obj = (properties: Record<string, object>, required: string[] = []) => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});

const DATUM = (what: string) => S(`${what} im Format YYYY-MM-DD`);
const ZEIT = (what: string) => S(`${what} im Format HH:MM (24 Stunden)`);
const ART = S("Art des Termins", { enum: ["exam", "lecture", "deadline", "other"] });
const ID_TERMIN = S("ID des Termins aus termine_auflisten");
const ID_AUFGABE = S("ID der Aufgabe aus aufgaben_auflisten");

const PAGES: Record<string, string> = {
  "/": "Startseite mit Tagesüberblick",
  "/aufgaben": "Aufgaben (To-dos)",
  "/stundenplan": "Stundenplan",
  "/lernplan": "Lernplan mit Wochenrückblick",
  "/kalender": "Kalender mit Terminen und Abos",
  "/vorlesungen": "Vorlesungen und Nachbereitung (Folien hochladen)",
  "/lernen": "Karteikarten lernen",
  "/fokus": "Fokus-Timer und Lernzeit",
  "/studium": "Studienplan mit Noten und Kreditpunkten",
  "/pharmazie": "Pharmazie-Fachwissen",
  "/links": "Linksammlung",
  "/karten": "Übersicht aller Karteikarten",
  "/statistik": "Lernstatistik",
  "/konto": "Konto und Abgleich",
};

export const TOOL_DECLARATIONS: { name: string; description: string; parameters?: object }[] = [
  {
    name: "termine_auflisten",
    description:
      "Listet Termine (Stundenplan, eigene Termine, Prüfungen, Fristen, Kalender-Abos, Aufgaben mit Datum) in einem Zeitraum auf.",
    parameters: obj({ von: DATUM("Erster Tag"), bis: DATUM("Letzter Tag (inklusive), Standard = von"), art: ART }, ["von"]),
  },
  {
    name: "termin_anlegen",
    description:
      "Legt einen neuen eigenen Termin an. Ohne Beginn ist er ganztägig, ohne Ende dauert er eine Stunde. Wiederkehrend („jeden Samstag“): woechentlich = true und datum = der nächste solche Wochentag; ein Termin genügt, die Wiederholungen erscheinen automatisch.",
    parameters: obj(
      {
        titel: S("Titel des Termins"),
        datum: DATUM("Tag"),
        beginn: ZEIT("Beginn"),
        ende: ZEIT("Ende"),
        art: ART,
        fach: S("Fach, falls passend"),
        ort: S("Ort oder Raum"),
        notiz: S("Notiz"),
        woechentlich: { type: "boolean", description: "true = jede Woche am selben Wochentag wiederholen" },
        wiederholen_bis: DATUM("Letzter Tag der Wiederholung (inklusive), ohne Angabe unbegrenzt"),
      },
      ["titel", "datum"],
    ),
  },
  {
    name: "termin_aendern",
    description:
      "Ändert einen eigenen Termin. Termine aus dem Stundenplan oder aus Kalender-Abos lassen sich nicht ändern. Nur angegebene Felder werden geändert. Bei einer Serie (serie in der Liste) gilt die Änderung für die ganze Serie.",
    parameters: obj(
      {
        id: ID_TERMIN,
        titel: S("Neuer Titel"),
        datum: DATUM("Neuer Tag"),
        beginn: ZEIT("Neuer Beginn"),
        ende: ZEIT("Neues Ende"),
        art: ART,
        ort: S("Neuer Ort"),
        notiz: S("Neue Notiz"),
        fach: S("Neues Fach"),
        woechentlich: { type: "boolean", description: "true = jede Woche wiederholen, false = Wiederholung entfernen" },
        wiederholen_bis: DATUM("Neues Ende der Wiederholung (inklusive), leer = unbegrenzt"),
      },
      ["id"],
    ),
  },
  {
    name: "termin_loeschen",
    description: "Löscht einen eigenen Termin (bei einer Serie die ganze Serie). Vorher beim Nutzer nachfragen, ausser er hat es eindeutig verlangt.",
    parameters: obj({ id: ID_TERMIN }, ["id"]),
  },
  {
    name: "aufgaben_auflisten",
    description: "Listet Aufgaben (To-dos) auf, offene nach Dringlichkeit sortiert.",
    parameters: obj({ filter: S("Welche Aufgaben, Standard offen", { enum: ["offen", "erledigt", "alle"] }) }),
  },
  {
    name: "aufgabe_anlegen",
    description: "Legt eine neue Aufgabe an.",
    parameters: obj(
      {
        titel: S("Titel der Aufgabe"),
        faellig: DATUM("Fälligkeitstag"),
        zeit: ZEIT("Uhrzeit (nur mit Fälligkeitstag)"),
        kategorie: S(`Kategorie, z. B. ${TODO_CATEGORIES.join(", ")}. Standard Eigene`),
        notiz: S("Notiz"),
        link: S("Internetadresse"),
      },
      ["titel"],
    ),
  },
  {
    name: "aufgabe_aendern",
    description:
      "Ändert eine Aufgabe oder hakt sie ab (erledigt). Nur angegebene Felder werden geändert; faellig oder zeit mit leerem Text entfernen den Wert.",
    parameters: obj(
      {
        id: ID_AUFGABE,
        titel: S("Neuer Titel"),
        faellig: DATUM("Neuer Fälligkeitstag"),
        zeit: ZEIT("Neue Uhrzeit"),
        kategorie: S("Neue Kategorie"),
        notiz: S("Neue Notiz"),
        erledigt: { type: "boolean", description: "true = erledigt, false = wieder offen" },
      },
      ["id"],
    ),
  },
  {
    name: "aufgabe_loeschen",
    description: "Löscht eine Aufgabe. Vorher beim Nutzer nachfragen, ausser er hat es eindeutig verlangt.",
    parameters: obj({ id: ID_AUFGABE }, ["id"]),
  },
  {
    name: "tagesueberblick",
    description:
      "Gibt den Überblick für jetzt: Begrüssung, was gerade läuft, was als Nächstes kommt, was heute noch ansteht, Hinweise und fällige Karten.",
  },
  {
    name: "lernstand",
    description: "Lernstand der Karteikarten: pro Fach der Anteil sicherer Karten und fällige Karten, oder für ein bestimmtes Fach.",
    parameters: obj({ fach: S("Fach, leer für alle Fächer") }),
  },
  {
    name: "lernzeit_eintragen",
    description: "Trägt eine Lerneinheit nach.",
    parameters: obj(
      { fach: S("Fach"), minuten: { type: "integer", description: "Dauer in Minuten (1 bis 900)" }, datum: DATUM("Tag, Standard heute") },
      ["fach", "minuten"],
    ),
  },
  {
    name: "lernzeit_auswerten",
    description: "Wertet die Lernzeit der letzten Tage aus: Summe und pro Fach.",
    parameters: obj({ tage: { type: "integer", description: "Anzahl Tage inklusive heute, Standard 7" } }),
  },
  {
    name: "noten_auflisten",
    description: "Listet eingetragene Noten und Prüfungsstatus aus dem Studienplan auf, dazu die erworbenen Kreditpunkte.",
  },
  {
    name: "note_eintragen",
    description: "Trägt Note oder Status einer Lehrveranstaltung des Studienplans ein. Ab Note 4 gilt sie als bestanden.",
    parameters: obj(
      {
        kurs: S("Name der Lehrveranstaltung (ungefähr)"),
        note: { type: "number", description: "Note von 1 bis 6 in ganzen oder halben Schritten" },
        status: S("Status, wenn keine Note", { enum: ["offen", "bestanden", "nicht bestanden"] }),
      },
      ["kurs"],
    ),
  },
  {
    name: "vorlesungen_auflisten",
    description: "Listet die nachbereiteten Vorlesungen auf, neueste zuerst.",
    parameters: obj({ fach: S("Fach, leer für alle") }),
  },
  {
    name: "fokus_starten",
    description: "Öffnet den Fokus-Timer und startet ihn.",
    parameters: obj({
      fach: S("Fach, an dem gearbeitet wird"),
      minuten: { type: "integer", description: "Dauer in Minuten, ohne Angabe die Standarddauer" },
    }),
  },
  {
    name: "nachbereitung_plan",
    description:
      "Nachbereitungsplan: wie viele Vorlesungen seit Semesterbeginn noch nachzubereiten sind (Rückstand, pro Woche), wann der Rückstand aufgeholt ist und die geplanten Einheiten der nächsten Tage. Die Einheiten liegen automatisch in freien Nachmittagen, Abenden und am Wochenende.",
    parameters: obj({ tage: { type: "integer", description: "Wie viele Tage voraus die Einheiten zeigen, Standard 7" } }),
  },
  {
    name: "nachbereitung_erledigt",
    description:
      "Hakt eine Vorlesung als nachbereitet ab. Ohne Angaben die laufende oder zuletzt geplante Einheit; mit fach (und datum der Vorlesung) eine bestimmte, sonst die älteste offene dieses Fachs.",
    parameters: obj({ fach: S("Fach der Vorlesung"), datum: DATUM("Tag, an dem die Vorlesung stattfand"), alle_bis: DATUM("Alle offenen Vorlesungen des Fachs bis zu diesem Tag abhaken") }),
  },
  {
    name: "nachbereitung_verschieben",
    description:
      "Legt die Einheit einer Vorlesung auf eine feste Zeit. Ohne neues_datum/beginn kommen nur Vorschläge für freie Zeiten zurück, die du dem Nutzer anbietest. Ohne fach die nächste geplante Einheit.",
    parameters: obj({
      fach: S("Fach der Vorlesung"),
      datum: DATUM("Tag, an dem die Vorlesung stattfand"),
      neues_datum: DATUM("Neuer Tag der Einheit"),
      beginn: ZEIT("Neuer Beginn der Einheit"),
      automatisch: { type: "boolean", description: "true = feste Zeit aufheben, Jarvis plant selbst" },
    }),
  },
  {
    name: "keine_zeit",
    description:
      "Der Nutzer hat keine Zeit (z. B. „heute Nachmittag kann ich nicht“, „am Wochenende bin ich weg“). Trägt eine Sperre in den Kalender ein; die Nachbereitung in dieser Zeit wird automatisch verschoben. Gibt zurück, was wohin verschoben wurde, mit Vorschlägen.",
    parameters: obj(
      {
        datum: DATUM("Erster Tag"),
        bis_datum: DATUM("Letzter Tag (inklusive), Standard = datum"),
        von: ZEIT("Beginn, ohne Angabe ganztägig"),
        bis: ZEIT("Ende"),
        grund: S("Kurzer Grund, z. B. Arbeit"),
      },
      ["datum"],
    ),
  },
  {
    name: "lernzeiten_einstellen",
    description:
      "Ändert, wann Nachbereitung geplant werden darf: Zeitfenster werktags und am Wochenende, Höchstdauer pro Tag, Dauer pro Vorlesung, Plan an oder aus. Nur angegebene Felder werden geändert.",
    parameters: obj({
      an: { type: "boolean", description: "Plan an oder aus" },
      dauer: { type: "integer", description: "Minuten pro Vorlesung (20 bis 180)" },
      werktags_von: ZEIT("Werktags frühester Beginn"),
      werktags_bis: ZEIT("Werktags spätestes Ende"),
      werktags_max: { type: "integer", description: "Werktags höchstens so viele Minuten pro Tag" },
      wochenende: { type: "boolean", description: "Auch am Wochenende planen" },
      wochenende_von: ZEIT("Wochenende frühester Beginn"),
      wochenende_bis: ZEIT("Wochenende spätestes Ende"),
      wochenende_max: { type: "integer", description: "Am Wochenende höchstens so viele Minuten pro Tag" },
    }),
  },
  {
    name: "merken",
    description:
      "Merkt sich dauerhaft etwas über den Nutzer, das in späteren Gesprächen hilft (Vorlieben, Arbeitszeiten, Ziele, z. B. „arbeitet freitags bis 21 Uhr“). Nur auf Wunsch oder wenn es klar nützlich ist; keine Passwörter oder Gesundheitsdaten.",
    parameters: obj({ fakt: S("Was du dir merkst, ein kurzer Satz") }, ["fakt"]),
  },
  {
    name: "vergessen",
    description: "Vergisst einen gemerkten Punkt (Teil des Textes genügt) oder mit alles = true alle.",
    parameters: obj({ fakt: S("Text oder Teil davon"), alles: { type: "boolean", description: "Alles vergessen" } }),
  },
  {
    name: "seite_oeffnen",
    description: `Öffnet eine Seite der App. ${Object.entries(PAGES).map(([p, d]) => `${p}: ${d}`).join("; ")}.`,
    parameters: obj({ seite: S("Pfad der Seite", { enum: Object.keys(PAGES) }) }, ["seite"]),
  },
  {
    name: "link_oeffnen",
    description: "Öffnet einen Link aus der Linksammlung (z. B. ADAM, Uni-Mail, Compendium) in einem neuen Tab.",
    parameters: obj({ name: S("Name oder Gruppe des Links") }, ["name"]),
  },
];

// ---------- Hilfen ----------

/** Fehler, die der Nutzer/das Modell versteht (werden als { fehler } zurückgegeben). */
class Bad extends Error {}
const fail = (msg: string): never => {
  throw new Bad(msg);
};

const KINDS = ["exam", "lecture", "deadline", "other"];
const MAX_LIST = 80;

function str(a: Args, k: string) {
  const v = a[k];
  return v === undefined || v === null ? undefined : String(v).trim();
}
const req = (a: Args, k: string) => str(a, k) || fail(`Es fehlt: ${k}.`);

/** Datum YYYY-MM-DD; "" nur, wenn `empty` erlaubt ist (zum Entfernen). */
function date(a: Args, k: string, empty = false) {
  const v = str(a, k);
  if (v === undefined || (empty && v === "")) return v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isoDate(parseIsoDate(v)) !== v) fail(`${k}: „${v}“ ist kein gültiges Datum (erwartet YYYY-MM-DD).`);
  return v;
}

function time(a: Args, k: string, empty = false) {
  const v = str(a, k);
  if (v === undefined || (empty && v === "")) return v;
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) fail(`${k}: „${v}“ ist keine gültige Uhrzeit (erwartet HH:MM).`);
  return v;
}

function kind(a: Args) {
  const v = str(a, "art");
  if (v !== undefined && !KINDS.includes(v)) fail(`art: „${v}“ ist ungültig (erlaubt: ${KINDS.join(", ")}).`);
  return v as EventKind | undefined;
}

function int(a: Args, k: string, min: number, max: number) {
  const v = a[k];
  if (v === undefined || v === null) return undefined;
  const n = Math.round(Number(v));
  if (!(n >= min && n <= max)) fail(`${k} muss zwischen ${min} und ${max} liegen.`);
  return n;
}

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

async function plannerData(ctx: ToolContext): Promise<PlannerData> {
  const [slots, events, feeds, caches, todos] = await Promise.all([
    ctx.store.list("slots"),
    ctx.store.list("events"),
    ctx.store.list("feeds"),
    ctx.store.feedCaches(),
    ctx.store.list("todos"),
  ]);
  return { slots, events, feeds, caches, todos };
}

const serieText = (e?: CalEvent) =>
  e?.repeat ? `wöchentlich${e.repeat.until ? ` (bis ${fmtShortDay(parseIsoDate(e.repeat.until))})` : ""}` : undefined;

const row = (o: Occurrence) => ({
  id: o.key,
  titel: o.title,
  art: KIND_LABEL[o.kind],
  typ: o.type,
  datum: fmtShortDay(o.start),
  zeit: o.allDay ? "ganztägig" : `${fmtTime(o.start)}–${fmtTime(o.end)}`,
  ort: o.location,
  fach: o.course,
  notiz: o.note.slice(0, 120),
  aenderbar: o.origin.kind === "event",
});

/** Zeile eines eigenen Termins; bei Serien mit Hinweis. */
const eventOccRow = (o: Occurrence, e?: CalEvent) => ({ ...row(o), ...(serieText(e) ? { serie: serieText(e) } : {}) });

const eventRow = (e: CalEvent) => eventOccRow(occurrences({ ...EMPTY_PLANNER, events: [e] }, 0, Infinity)[0], e); // bei Serien nur das erste Vorkommen

/** Eigener Termin zur ID ("event:<uuid>", "event:<uuid>:<datum>" bei Serien oder nur die uuid); andere Quellen werden abgewiesen. */
async function ownEvent(a: Args, ctx: ToolContext) {
  const id = req(a, "id");
  const other = /^(slot|feed):/.exec(id);
  if (other) fail("Dieser Termin kommt aus dem Stundenplan oder einem Kalender-Abo und lässt sich per Sprache nicht ändern.");
  if (id.startsWith("prep:")) fail("Das ist eine geplante Nachbereitung. Dafür gibt es nachbereitung_verschieben oder keine_zeit.");
  if (id.startsWith("todo:")) fail("Das ist eine Aufgabe mit Datum, kein Termin. Dafür gibt es aufgabe_aendern.");
  const bare = id.replace(/^event:/, "").replace(/:\d{4}-\d{2}-\d{2}$/, "");
  const e = (await ctx.store.list("events")).find((x) => x.id === bare);
  return e ?? fail(`Keinen eigenen Termin mit der ID „${id}“ gefunden.`);
}

/** Überschneidungen eines Termins (nächste 4 Vorkommen bei Serien) mit Stundenplan und anderen Terminen. */
async function clashes(ctx: ToolContext, e: CalEvent) {
  if (e.allDay) return {};
  const data = await plannerData(ctx);
  const mine = occurrences({ ...EMPTY_PLANNER, events: [e] }, ctx.now - DAYMS, addDays(ctx.now, 60)).slice(0, 4);
  if (!mine.length) return {};
  const others = occurrences({ ...data, todos: [], events: data.events.filter((x) => x.id !== e.id) }, mine[0].start, mine.at(-1)!.end).filter((o) => !o.allDay);
  const hit = others.filter((o) => mine.some((m) => o.start < m.end && m.start < o.end));
  return hit.length ? { ueberschneidungen: hit.slice(0, 6).map((o) => `${o.title} (${KIND_LABEL[o.kind]}), ${when(o.start)}–${fmtTime(o.end)}`) } : {};
}

async function todoById(a: Args, ctx: ToolContext) {
  const id = req(a, "id").replace(/^todo:/, "");
  const t = (await ctx.store.list("todos")).find((x) => x.id === id);
  return t ?? fail(`Keine Aufgabe mit der ID „${id}“ gefunden.`);
}

const todoRow = (t: Todo, now: number) => ({
  id: t.id,
  titel: t.title,
  faellig: t.due ? `${fmtShortDay(parseIsoDate(t.due))}${t.done ? "" : ` (${dueLabel(t.due, now)})`}` : "",
  zeit: t.time ?? "",
  kategorie: t.category,
  notiz: t.note.slice(0, 120),
  erledigt: t.done,
});

async function courseNames(ctx: ToolContext, data?: PlannerData) {
  const [d, lectures] = await Promise.all([data ?? plannerData(ctx), ctx.store.lectures()]);
  return knownCourses(d, lectures.map((l) => l.course));
}

// ---------- Nachbereitung und Gedächtnis ----------

export async function loadPrep(store: ToolStore, now: number, data?: PlannerData): Promise<{ plan: PrepPlan; data: PlannerData; marks: Mark[] }> {
  const [d, lectures, marks] = await Promise.all([
    data ?? Promise.all([store.list("slots"), store.list("events"), store.list("feeds"), store.feedCaches()]).then(([slots, events, feeds, caches]) => ({ slots, events, feeds, caches })),
    store.lectures(),
    store.list("marks"),
  ]);
  return { plan: prepPlan(d, liteLectures(lectures), marks, now), data: d, marks };
}

const when = (t: number) => `${fmtShortDay(t)}, ${fmtTime(t)}`;
const lessonText = (o: Occurrence) => `${o.course} vom ${fmtShortDay(o.start)}`;

/** Führt eine Änderung aus und meldet, welche Einheiten dadurch nach hinten gerutscht sind, mit Vorschlägen. */
async function watchPrep<T extends Record<string, unknown>>(ctx: ToolContext, change: () => Promise<T>): Promise<T> {
  const before = snapshot((await loadPrep(ctx.store, ctx.now)).plan, ctx.now);
  const result = await change();
  const { plan, data } = await loadPrep(ctx.store, ctx.now);
  const moved = postponed(before, plan, data, ctx.now);
  if (!moved.length) return result;
  return {
    ...result,
    nachbereitung_verschoben: moved.map((m) => ({
      vorlesung: lessonText(m.lesson),
      vorher: when(m.from),
      neu: m.session ? when(m.session.start) : "noch kein freier Platz",
      vorschlaege: alternatives(data, plan, m.lesson, ctx.now).map(when),
    })),
  };
}

/** Lektion aus Rückstand oder Plan: nach Fach und Tag, sonst die laufende oder nächste Einheit. */
function findLesson(plan: PrepPlan, a: Args, now: number) {
  const fach = str(a, "fach");
  const datum = date(a, "datum");
  const all = [...plan.backlog, ...plan.sessions.map((x) => x.lesson).filter((o) => !plan.backlog.some((b) => b.key === o.key))].sort(
    (x, y) => x.start - y.start,
  );
  if (!fach && !datum) {
    const s = plan.sessions.find((x) => x.end > now - 6 * HOUR) ?? plan.sessions[0];
    return s?.lesson ?? all[0] ?? fail("Es ist keine Vorlesung offen.");
  }
  const hits = all.filter(
    (o) => (!fach || sameCourse(o.course, fach) || o.course.toLowerCase().includes(fach.toLowerCase())) && (!datum || isoDate(o.start) === datum),
  );
  if (!hits.length) fail(`Keine offene Vorlesung${fach ? ` in ${fach}` : ""}${datum ? ` am ${fmtShortDay(parseIsoDate(datum))}` : ""} gefunden.`);
  return hits[0];
}

const MEMORY_ID = "jarvis-memory";
type MemoryMark = Mark & { facts?: string[] };
const MAX_FACTS = 40;

export async function memoryFacts(store: ToolStore) {
  return ((await store.list("marks")).find((m) => m.id === MEMORY_ID) as MemoryMark | undefined)?.facts ?? [];
}

// ---------- Werkzeuge ----------

const TOOLS: Record<string, (a: Args, ctx: ToolContext) => Promise<Record<string, unknown>>> = {
  async termine_auflisten(a, ctx) {
    const von = date(a, "von") ?? fail("Es fehlt: von.");
    const bis = date(a, "bis") ?? von;
    const art = kind(a);
    if (bis < von) fail("bis liegt vor von.");
    const data = await plannerData(ctx);
    const { plan } = await loadPrep(ctx.store, ctx.now, data);
    const [from, to] = [parseIsoDate(von), parseIsoDate(bis) + DAYMS];
    const all = [...occurrences(data, from, to, await courseNames(ctx, data)), ...plan.sessions.filter((x) => x.end > from && x.start < to)]
      .sort((x, y) => x.start - y.start)
      .filter((o) => !art || o.kind === art);
    return { anzahl: all.length, termine: all.slice(0, MAX_LIST).map((o) => eventOccRow(o, o.origin.kind === "event" ? data.events.find((e) => e.id === o.origin.id) : undefined)), ...(all.length > MAX_LIST ? { gekuerzt: `Nur die ersten ${MAX_LIST} gezeigt.` } : {}) };
  },

  async termin_anlegen(a, ctx) {
    const titel = req(a, "titel");
    const datum = date(a, "datum") ?? fail("Es fehlt: datum.");
    const beginn = time(a, "beginn");
    const ende = time(a, "ende");
    if (ende && !beginn) fail("Ein Ende braucht auch einen Beginn.");
    const day = parseIsoDate(datum);
    const start = beginn ? atTime(day, beginn) : day;
    const end = beginn ? (ende ? atTime(day, ende) : start + HOUR) : null;
    if (end !== null && end <= start) fail("Das Ende muss nach dem Beginn liegen.");
    const fach = str(a, "fach") ?? "";
    const bis = date(a, "wiederholen_bis");
    if (bis && bis < datum) fail("wiederholen_bis liegt vor datum.");
    const e: CalEvent = {
      id: crypto.randomUUID(),
      title: titel,
      course: fach && matchExistingCourse(fach, await courseNames(ctx)),
      kind: kind(a) ?? guessKind(titel),
      start,
      end,
      allDay: !beginn,
      location: str(a, "ort") ?? "",
      note: str(a, "notiz") ?? "",
      source: "manual",
      ...(a.woechentlich === true || (a.woechentlich !== false && bis) ? { repeat: { every: "week" as const, ...(bis ? { until: bis } : {}) } } : {}),
      createdAt: ctx.now,
    };
    return watchPrep(ctx, async () => {
      await ctx.store.put("events", e);
      return { ok: true, termin: eventRow(e), ...(await clashes(ctx, e)) };
    });
  },

  async termin_aendern(a, ctx) {
    const e = await ownEvent(a, ctx);
    const datum = date(a, "datum");
    const beginn = time(a, "beginn");
    const ende = time(a, "ende");
    const art = kind(a);
    const fach = str(a, "fach");
    const next: CalEvent = {
      ...e,
      title: str(a, "titel") || e.title,
      kind: art ?? e.kind,
      location: str(a, "ort") ?? e.location,
      note: str(a, "notiz") ?? e.note,
      course: fach === undefined ? e.course : fach && matchExistingCourse(fach, await courseNames(ctx)),
    };
    if (datum || beginn || ende) {
      const day = parseIsoDate(datum ?? isoDate(e.start));
      const von = beginn ?? (e.allDay ? undefined : hhmm(e.start));
      next.allDay = !von;
      next.start = von ? atTime(day, von) : day;
      const dauer = e.end && !e.allDay ? e.end - e.start : HOUR;
      next.end = von ? (ende ? atTime(day, ende) : next.start + dauer) : null;
      if (next.end !== null && next.end <= next.start) fail("Das Ende muss nach dem Beginn liegen.");
    }
    const bis = date(a, "wiederholen_bis", true);
    if (a.woechentlich === false) delete next.repeat;
    else if (a.woechentlich === true || bis) {
      const until = bis === undefined ? e.repeat?.until : bis || undefined;
      next.repeat = { every: "week", ...(until ? { until } : {}), ...(e.repeat?.skip ? { skip: e.repeat.skip } : {}) };
    }
    if (next.repeat?.until && next.repeat.until < isoDate(next.start)) fail("wiederholen_bis liegt vor dem Termin.");
    return watchPrep(ctx, async () => {
      await ctx.store.put("events", next);
      return { ok: true, termin: eventRow(next), ...(await clashes(ctx, next)) };
    });
  },

  async termin_loeschen(a, ctx) {
    const e = await ownEvent(a, ctx);
    await ctx.store.remove("events", [e.id]);
    return { ok: true, geloescht: eventRow(e).titel };
  },

  async aufgaben_auflisten(a, ctx) {
    const filter = str(a, "filter") ?? "offen";
    if (!["offen", "erledigt", "alle"].includes(filter)) fail("filter: erlaubt sind offen, erledigt, alle.");
    const todos = groupTodos(await ctx.store.list("todos"), ctx.now)
      .flatMap((g) => g.items)
      .filter((t) => filter === "alle" || t.done === (filter === "erledigt"));
    return { anzahl: todos.length, aufgaben: todos.slice(0, MAX_LIST).map((t) => todoRow(t, ctx.now)), ...(todos.length > MAX_LIST ? { gekuerzt: `Nur die ersten ${MAX_LIST} gezeigt.` } : {}) };
  },

  async aufgabe_anlegen(a, ctx) {
    const faellig = date(a, "faellig");
    let link = str(a, "link");
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
    const t: Todo = {
      id: crypto.randomUUID(),
      title: req(a, "titel"),
      note: str(a, "notiz") ?? "",
      category: str(a, "kategorie") || "Eigene",
      due: faellig || undefined,
      time: faellig ? time(a, "zeit") || undefined : undefined,
      link: link || undefined,
      done: false,
      createdAt: ctx.now,
    };
    await ctx.store.put("todos", t);
    return { ok: true, aufgabe: todoRow(t, ctx.now) };
  },

  async aufgabe_aendern(a, ctx) {
    const t = await todoById(a, ctx);
    const faellig = date(a, "faellig", true);
    const zeit = time(a, "zeit", true);
    const next: Todo = {
      ...t,
      title: str(a, "titel") || t.title,
      note: str(a, "notiz") ?? t.note,
      category: str(a, "kategorie") || t.category,
      due: faellig === undefined ? t.due : faellig || undefined,
      time: zeit === undefined ? t.time : zeit || undefined,
    };
    if (!next.due) next.time = undefined;
    if (typeof a.erledigt === "boolean" && a.erledigt !== t.done) {
      next.done = a.erledigt;
      next.doneAt = a.erledigt ? ctx.now : undefined;
    }
    await ctx.store.put("todos", next);
    return { ok: true, aufgabe: todoRow(next, ctx.now) };
  },

  async aufgabe_loeschen(a, ctx) {
    const t = await todoById(a, ctx);
    await ctx.store.remove("todos", [t.id]);
    return { ok: true, geloescht: t.title };
  },

  async tagesueberblick(_a, ctx) {
    const { now } = ctx;
    const [data, lectures, cards, newLeft, previews] = await Promise.all([
      plannerData(ctx),
      ctx.store.lectures(),
      ctx.store.cards(),
      ctx.store.newLeft(),
      ctx.store.list("previews"),
    ]);
    const { plan } = await loadPrep(ctx.store, now, data);
    const list = [...occurrences(data, now - 4 * DAYMS, now + 60 * DAYMS, knownCourses(data, lectures.map((l) => l.course))), ...plan.sessions].sort(
      (x, y) => x.start - y.start,
    );
    const { current, next } = nowAndNext(list, now);
    const heute = list.filter((o) => o.end > now && o.start < addDays(dayStart(now), 1));
    const due = countDue(cards, newLeft, now);
    return {
      begruessung: greeting(now),
      jetzt: current.map(row),
      als_naechstes: next ? { ...row(next), wann: relTime(next.start, now) } : null,
      heute: heute.slice(0, MAX_LIST).map(row),
      hinweise: tips({ list, lectures, cards, previews, newLeft, now }).slice(0, 5).map((t) => t.text),
      faellige_karten: { neu: due.new, lernen: due.learning, wiederholen: due.review },
      nachbereitung: { rueckstand: plan.backlog.length, aufgeholt_bis: plan.catchUp ? fmtShortDay(plan.catchUp) : null },
    };
  },

  async lernstand(a, ctx) {
    const [lectures, cards, newLeft] = await Promise.all([ctx.store.lectures(), ctx.store.cards(), ctx.store.newLeft()]);
    const names = await courseNames(ctx);
    const one = (fach: string) => {
      const r = readiness(fach, lectures, cards, newLeft);
      return { fach, vorlesungen: r.lectures, karten: r.cards, sicher_prozent: r.pct, faellig: r.due };
    };
    const fach = str(a, "fach");
    if (fach) {
      const f = matchExistingCourse(fach, names);
      const r = one(f);
      return r.vorlesungen ? r : { fach: f, hinweis: "Zu diesem Fach gibt es noch keine Nachbereitung mit Karten." };
    }
    const due = countDue(cards, newLeft, ctx.now);
    return {
      faecher: names.map(one).filter((r) => r.karten > 0),
      faellig_gesamt: due.new + due.learning + due.review,
    };
  },

  async lernzeit_eintragen(a, ctx) {
    const fach = req(a, "fach");
    const m = int(a, "minuten", 1, 900) ?? fail("Es fehlt: minuten.");
    const datum = date(a, "datum") ?? isoDate(ctx.now);
    // Heute: als gerade beendet eintragen, sonst mittags (wie die Fokus-Seite)
    const start = datum === isoDate(ctx.now) ? ctx.now - m * MIN : atTime(parseIsoDate(datum), "12:00");
    const s: StudySession = {
      id: crypto.randomUUID(),
      course: matchExistingCourse(fach, await courseNames(ctx)),
      start,
      minutes: m,
      kind: "frei",
      createdAt: ctx.now,
    };
    await ctx.store.put("sessions", s);
    return { ok: true, fach: s.course, minuten: m, datum: fmtShortDay(parseIsoDate(datum)) };
  },

  async lernzeit_auswerten(a, ctx) {
    const tage = int(a, "tage", 1, 365) ?? 7;
    const since = addDays(dayStart(ctx.now), 1 - tage);
    const per = new Map<string, number>();
    let total = 0;
    for (const s of await ctx.store.list("sessions")) {
      if (s.start < since) continue;
      total += s.minutes;
      per.set(s.course || "ohne Fach", (per.get(s.course || "ohne Fach") ?? 0) + s.minutes);
    }
    return {
      tage,
      minuten_gesamt: total,
      pro_fach: [...per].sort((x, y) => y[1] - x[1]).map(([fach, minuten]) => ({ fach, minuten })),
    };
  },

  async noten_auflisten(_a, ctx) {
    const recs = await ctx.store.list("grades");
    const { results, extras } = gradeData(recs);
    return {
      erworbene_kp: summarize(PLAN, results, extras).earned,
      kp_total: TOTAL_KP,
      eintraege: recs.map((r) => ({ kurs: r.course, status: r.status, note: r.grade ?? null })),
    };
  },

  async note_eintragen(a, ctx) {
    const kurs = req(a, "kurs").toLowerCase();
    const status = str(a, "status") as CourseRecord["status"] | undefined;
    if (status && !["offen", "bestanden", "nicht bestanden"].includes(status)) fail("status: erlaubt sind offen, bestanden, nicht bestanden.");
    let grade: number | undefined;
    if (a.note !== undefined && a.note !== null) {
      grade = Number(String(a.note).replace(",", "."));
      if (!validGrade(grade)) fail("Die Note muss zwischen 1 und 6 in ganzen oder halben Schritten liegen (z. B. 4.5).");
    }
    if (grade === undefined && !status) fail("Es fehlt: note oder status.");
    const hits = PLAN.filter((c) => c.course.toLowerCase() === kurs);
    const found = hits.length
      ? hits
      : PLAN.filter((c) => c.course.toLowerCase().includes(kurs) || kurs.includes(c.course.toLowerCase()) || sameCourse(c.course, kurs));
    if (!found.length) fail(`Keine Lehrveranstaltung im Studienplan zu „${kurs}“ gefunden.`);
    if (found.length > 1) fail(`Mehrere passen, welche ist gemeint? ${found.slice(0, 8).map((c) => c.course).join("; ")}`);
    const c: PlanCourse = found[0];
    const existing = (await ctx.store.list("grades")).find((r) => r.id === c.id);
    // Wie PlanView: Note bestimmt den Status; nur Status ändern behält die Note
    const g = grade ?? existing?.grade;
    const st = grade !== undefined ? (grade >= 4 ? "bestanden" : "nicht bestanden") : status!;
    if (st === "offen" && g === undefined) {
      if (existing) await ctx.store.remove("grades", [c.id]);
    } else {
      await ctx.store.put("grades", {
        id: c.id,
        module: c.module,
        stage: c.stage,
        course: c.course,
        semester: c.semester,
        kp: c.kp,
        assessment: c.assessment,
        status: st,
        ...(g !== undefined ? { grade: g } : {}),
        createdAt: existing?.createdAt ?? ctx.now,
      });
    }
    return { ok: true, kurs: c.course, status: st, note: g ?? null };
  },

  async vorlesungen_auflisten(a, ctx) {
    const fach = str(a, "fach");
    const list = (await ctx.store.lectures()).filter(
      (l) => !fach || sameCourse(l.course, fach) || l.course.toLowerCase().includes(fach.toLowerCase()),
    );
    return {
      anzahl: list.length,
      vorlesungen: list.slice(0, 30).map((l) => ({ id: l.id, titel: l.title, fach: l.course, datum: fmtShortDay(l.createdAt) })),
    };
  },

  async fokus_starten(a, ctx) {
    const minuten = int(a, "minuten", 1, 240) ?? 0;
    const fach = str(a, "fach") ?? "";
    ctx.startFocus(fach && matchExistingCourse(fach, await courseNames(ctx)), minuten);
    return { ok: true, fach, minuten: minuten || "Standarddauer" };
  },

  async nachbereitung_plan(a, ctx) {
    const tage = int(a, "tage", 1, 60) ?? 7;
    const { plan } = await loadPrep(ctx.store, ctx.now);
    const until = addDays(dayStart(ctx.now), tage);
    const next = plan.sessions.filter((x) => x.start < until);
    return {
      an: plan.settings.on,
      seit: fmtShortDay(plan.since),
      rueckstand: plan.backlog.length,
      rueckstand_pro_woche: plan.weeks
        .map((w) => ({ woche_ab: fmtShortDay(w.start), offen: w.lessons.filter((l) => !l.done).length, total: w.lessons.length }))
        .filter((w) => w.offen),
      aufgeholt_bis: plan.catchUp ? fmtShortDay(plan.catchUp) : plan.backlog.length ? "nicht absehbar, zu wenig Lernzeit eingestellt" : "kein Rückstand",
      ohne_platz: plan.unplanned.length,
      einheiten: next.slice(0, MAX_LIST).map((x) => ({
        id: x.key,
        vorlesung: lessonText(x.lesson),
        wann: `${when(x.start)}–${fmtTime(x.end)}`,
        fest: x.pinned,
      })),
      lernzeiten: plan.settings,
    };
  },

  async nachbereitung_erledigt(a, ctx) {
    const { plan } = await loadPrep(ctx.store, ctx.now);
    const bis = date(a, "alle_bis");
    if (bis) {
      const fach = str(a, "fach");
      const list = plan.backlog.filter((o) => isoDate(o.start) <= bis && (!fach || sameCourse(o.course, fach) || o.course.toLowerCase().includes(fach.toLowerCase())));
      if (!list.length) fail("Dazu ist nichts offen.");
      for (const o of list) await ctx.store.put("marks", { id: doneId(o.key), createdAt: ctx.now });
      return { ok: true, abgehakt: list.length, rueckstand: plan.backlog.length - list.length };
    }
    const o = findLesson(plan, a, ctx.now);
    await ctx.store.put("marks", { id: doneId(o.key), createdAt: ctx.now });
    const left = plan.backlog.filter((b) => b.key !== o.key).length;
    return { ok: true, abgehakt: lessonText(o), rueckstand: left };
  },

  async nachbereitung_verschieben(a, ctx) {
    const { plan, data } = await loadPrep(ctx.store, ctx.now);
    const o = findLesson(plan, a, ctx.now);
    if (a.automatisch === true) {
      await ctx.store.remove("marks", [`prep-pin:${o.key}`]);
      const after = (await loadPrep(ctx.store, ctx.now)).plan.sessions.find((x) => x.lesson.key === o.key);
      return { ok: true, vorlesung: lessonText(o), neu: after ? when(after.start) : "noch kein freier Platz" };
    }
    const tag = date(a, "neues_datum");
    const beginn = time(a, "beginn");
    if (!tag || !beginn) return { vorlesung: lessonText(o), vorschlaege: alternatives(data, plan, o, ctx.now, 4).map(when) };
    const start = atTime(parseIsoDate(tag), beginn);
    if (start < ctx.now) fail("Diese Zeit liegt in der Vergangenheit.");
    if (start < o.end) fail("Die Einheit kann erst nach der Vorlesung stattfinden.");
    const len = plan.settings.minutes * MIN;
    const busy = occurrences({ ...data, todos: [] }, start - DAYMS, start + len + DAYMS).find(
      (x) => (!x.allDay || x.kind === "exam" || x.kind === "other") && x.start < start + len && start < x.end,
    );
    if (busy) fail(`Da ist schon etwas: ${busy.title}, ${when(busy.start)}. Freie Zeiten: ${alternatives(data, plan, o, ctx.now).map(when).join("; ")}`);
    await ctx.store.put("marks", pinMark(o.key, start));
    return { ok: true, vorlesung: lessonText(o), neu: `${when(start)}–${fmtTime(start + len)}` };
  },

  async keine_zeit(a, ctx) {
    const datum = date(a, "datum") ?? fail("Es fehlt: datum.");
    const bisDatum = date(a, "bis_datum") ?? datum;
    if (bisDatum < datum) fail("bis_datum liegt vor datum.");
    const von = time(a, "von");
    const bis = time(a, "bis");
    if (bis && !von) fail("Ein Ende braucht auch einen Beginn.");
    const day = parseIsoDate(datum);
    const lastDay = parseIsoDate(bisDatum);
    if (addDays(lastDay, 0) - day > 60 * DAYMS) fail("Höchstens 60 Tage auf einmal.");
    const start = von ? atTime(day, von) : day;
    const end = von ? atTime(lastDay, bis ?? "23:59") : bisDatum === datum ? null : addDays(lastDay, 1);
    if (end !== null && end <= start) fail("Das Ende muss nach dem Beginn liegen.");
    const grund = str(a, "grund");
    const e: CalEvent = {
      id: crypto.randomUUID(),
      title: grund ? `Keine Zeit: ${grund}` : "Keine Zeit",
      course: "",
      kind: "other",
      start,
      end,
      allDay: !von,
      location: "",
      note: "Von Jarvis eingetragen; Nachbereitung wird in dieser Zeit nicht geplant.",
      source: "manual",
      createdAt: ctx.now,
    };
    return watchPrep(ctx, async () => {
      await ctx.store.put("events", e);
      return { ok: true, sperre: eventRow(e) };
    });
  },

  async lernzeiten_einstellen(a, ctx) {
    const s = readPrepSettings(await ctx.store.list("marks"));
    const t = (k: string, d: string) => time(a, k) ?? d;
    const n = (k: string, min: number, max: number, d: number) => int(a, k, min, max) ?? d;
    const next = {
      on: typeof a.an === "boolean" ? a.an : s.on,
      minutes: n("dauer", 20, 180, s.minutes),
      weekday: { from: t("werktags_von", s.weekday.from), to: t("werktags_bis", s.weekday.to), max: n("werktags_max", 0, 720, s.weekday.max) },
      weekend: {
        on: typeof a.wochenende === "boolean" ? a.wochenende : s.weekend.on,
        from: t("wochenende_von", s.weekend.from),
        to: t("wochenende_bis", s.weekend.to),
        max: n("wochenende_max", 0, 720, s.weekend.max),
      },
    };
    if (!validWindow(next.weekday.from, next.weekday.to) || !validWindow(next.weekend.from, next.weekend.to)) fail("Das Ende eines Zeitfensters muss nach dem Beginn liegen.");
    return watchPrep(ctx, async () => {
      await ctx.store.put("marks", prepSettingsMark(next));
      return { ok: true, lernzeiten: next, standard: DEFAULT_PREP };
    });
  },

  async merken(a, ctx) {
    const fakt = req(a, "fakt").slice(0, 200);
    const facts = (await memoryFacts(ctx.store)).filter((f) => f.toLowerCase() !== fakt.toLowerCase());
    const next = [...facts, fakt].slice(-MAX_FACTS);
    await ctx.store.put("marks", { id: MEMORY_ID, createdAt: ctx.now, facts: next } as MemoryMark);
    return { ok: true, gemerkt: fakt, anzahl: next.length };
  },

  async vergessen(a, ctx) {
    const facts = await memoryFacts(ctx.store);
    const fakt = str(a, "fakt")?.toLowerCase();
    if (!fakt && a.alles !== true) fail("Was soll ich vergessen?");
    const next = a.alles === true ? [] : facts.filter((f) => !f.toLowerCase().includes(fakt!));
    if (next.length === facts.length) fail(`Dazu habe ich mir nichts gemerkt. Gemerkt: ${facts.join("; ") || "nichts"}`);
    await ctx.store.put("marks", { id: MEMORY_ID, createdAt: ctx.now, facts: next } as MemoryMark);
    return { ok: true, vergessen: facts.length - next.length };
  },

  async seite_oeffnen(a, ctx) {
    const seite = req(a, "seite");
    if (!(seite in PAGES)) fail(`Unbekannte Seite „${seite}“. Möglich: ${Object.keys(PAGES).join(", ")}`);
    ctx.navigate(seite);
    return { ok: true, seite: PAGES[seite] };
  },

  async link_oeffnen(a, ctx) {
    const name = req(a, "name").toLowerCase();
    const links = (await ctx.store.list("links")).sort((x, y) => x.order - y.order);
    const exact = links.filter((l) => l.name.toLowerCase() === name);
    const hits = exact.length ? exact : links.filter((l) => l.name.toLowerCase().includes(name) || l.group.toLowerCase().includes(name));
    if (hits.length === 1) {
      ctx.openUrl(hits[0].url);
      return { ok: true, link: hits[0].name };
    }
    const names = (hits.length ? hits : links).slice(0, 8).map((l) => l.name).join("; ");
    return fail(hits.length ? `Mehrere Links passen: ${names}` : `Keinen Link zu „${name}“ gefunden. Vorhanden zum Beispiel: ${names}`);
  },
};

/** Ergebnisse und Wahlfächer aus den Noten-Einträgen, wie die Studium-Seite sie bildet. */
function gradeData(records: CourseRecord[]) {
  const results = new Map<string, Result>(records.map((r) => [r.id, { id: r.id, status: r.status, grade: r.grade }]));
  const extras: PlanCourse[] = records
    .filter((r) => r.id.startsWith("wahl-"))
    .map((r) => ({ id: r.id, stage: "Wahlbereich", module: "Wahlbereich", course: r.course, semester: r.semester, kp: r.kp, assessment: r.assessment }));
  return { results, extras };
}

/** Führt ein Werkzeug aus. Wirft nie: Fehler kommen als { fehler } zurück. */
export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<Record<string, unknown>> {
  const tool = TOOLS[name];
  if (!tool) return { fehler: `Unbekanntes Werkzeug „${name}“.` };
  try {
    return await tool(args && typeof args === "object" ? args : {}, ctx);
  } catch (e) {
    return { fehler: e instanceof Bad ? e.message : `Das hat nicht geklappt: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function systemPrompt(now: number, name = "", facts: string[] = []): string {
  const long = new Date(now).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `Du bist Jarvis, der persönliche Sprachassistent im Uni-Cockpit, ganz im Stil von J.A.R.V.I.S. aus Iron Man: höflich, souverän, knapp und mit einem Hauch trockenem Humor. Du duzt dein Gegenüber${name ? ` und sprichst es ab und zu mit seinem Namen ${name} an` : ""}. Es studiert im 1. Semester Pharmazeutische Wissenschaften an der Uni Basel.

Jetzt: ${long}, ${fmtTime(now)} Uhr. Heutiges Datum (ISO): ${isoDate(now)}. Rechne relative Angaben wie „morgen“ oder „nächsten Dienstag“ selbst in ein Datum YYYY-MM-DD um; Uhrzeiten gibst du den Werkzeugen als HH:MM.

Deine Antworten werden laut vorgelesen. Antworte deshalb auf Deutsch in ein bis drei kurzen Sätzen, in natürlicher gesprochener Sprache, ohne Markdown, ohne Aufzählungszeichen, ohne Sonderzeichen oder Emojis.

Regeln:
- Hol Daten immer mit den Werkzeugen. Erfinde nie Termine, Aufgaben, Noten oder Zahlen.
- Fehlt für einen neuen Termin etwas Wichtiges (zum Beispiel der Tag), frag kurz nach, statt zu raten.
- Nach dem Anlegen oder Ändern bestätigst du kurz, was gespeichert wurde, mit Tag und Uhrzeit.
- Vor dem Löschen eines Termins oder einer Aufgabe fragst du nach, ausser genau dieses Element sollte eindeutig gelöscht werden.
- Termine aus dem Stundenplan und aus Kalender-Abos kannst du nicht ändern; sag das ehrlich.
- Meldet ein Werkzeug einen Fehler, erklär ihn kurz und schlag den nächsten Schritt vor.
- Denk mit: Meldet ein Werkzeug ueberschneidungen, sag es und frag, ob der Termin so bleiben soll. Meldet es nachbereitung_verschoben, sag kurz, welche Nachbereitung wohin gerutscht ist, und biete einen der vorschlaege an; wählt der Nutzer eine Zeit, nutze nachbereitung_verschieben.
- Nachbereitung: Jede Vorlesung seit Semesterbeginn bekommt automatisch eine Einheit in freier Zeit (Nachmittag, Abend, Wochenende), neue Termine schieben sie automatisch weiter. Sagt der Nutzer, er habe keine Zeit, nutze keine_zeit. Sagt er, er habe etwas nachbereitet, nutze nachbereitung_erledigt. Fragen zum Rückstand beantwortest du mit nachbereitung_plan.
- Erzählt der Nutzer etwas Dauerhaftes über sich (Arbeitszeiten, Vorlieben, Ziele), merk es dir mit merken und berücksichtige es später, zum Beispiel beim Planen.${
    facts.length ? `

Das weisst du schon über dein Gegenüber:
${facts.map((f) => `- ${f}`).join("\n")}` : ""
  }`;
}

// ---------- Zugriff auf die Datenbank ----------

export const dbStore: ToolStore = {
  list: (store) => listItems(store),
  put: (store, value) => putItem(store, value),
  remove: deleteItems,
  lectures: listLectures,
  cards: allCards,
  newLeft: () => newCardsLeftToday(getSettings().newPerDay),
  feedCaches: allFeedCaches,
};
