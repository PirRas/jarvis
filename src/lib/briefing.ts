// Begrüssung beim Öffnen des Sprachbildschirms: Name, was heute noch ansteht, offene Aufgaben.
// Ohne KI-Aufruf gebaut (sofort da, kostet kein Kontingent) und so formuliert, dass es sich gut vorlesen lässt.

import { greeting } from "./jarvis";
import { addDays, dayStart, knownCourses, occurrences, type Occurrence } from "./planner";
import { readProfile } from "./profile";
import { countDue } from "./srs";
import { dueLabel, groupTodos } from "./todos";
import type { ToolStore } from "./voiceTools";

/** "14:15" → "14 Uhr 15", "09:00" → "9 Uhr" (klingt vorgelesen natürlicher). */
export function spokenTime(t: number) {
  const d = new Date(t);
  const m = d.getMinutes();
  return `${d.getHours()} Uhr${m ? ` ${m}` : ""}`;
}

/** "A", "A und B", "A, B und C" */
export function joinDe(items: string[]) {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} und ${items.at(-1)}`;
}

const what = (o: Occurrence) => `${o.allDay ? "" : `um ${spokenTime(o.start)} `}${o.title}${o.location && !o.allDay ? ` in ${o.location}` : ""}`;

/** Name aus dem Konto (Profil), nur der Vorname. */
export async function userName(store: ToolStore) {
  return readProfile(await store.list("marks"))?.name.trim().split(/\s+/)[0] ?? "";
}

export async function briefing(store: ToolStore, now = Date.now()) {
  const [name, slots, events, feeds, caches, todos, lectures, cards, newLeft] = await Promise.all([
    userName(store),
    store.list("slots"),
    store.list("events"),
    store.list("feeds"),
    store.feedCaches(),
    store.list("todos"),
    store.lectures(),
    store.cards(),
    store.newLeft(),
  ]);
  const data = { slots, events, feeds, caches, todos };
  const tomorrow = dayStart(addDays(now, 1));
  const list = occurrences(data, now, addDays(tomorrow, 1), knownCourses(data, lectures.map((l) => l.course)));
  const today = list.filter((o) => o.start < tomorrow && o.end > now && o.origin.kind !== "todo");
  const next = list.find((o) => o.start >= tomorrow && !o.allDay && o.origin.kind !== "todo");

  const parts = [`${greeting(now)}${name ? `, ${name}` : ""}.`];
  if (today.length) parts.push(`Heute steht noch an: ${joinDe(today.slice(0, 4).map(what))}${today.length > 4 ? ` und ${today.length - 4} weitere` : ""}.`);
  else parts.push(`Heute ist nichts mehr im Kalender${next ? `; morgen geht es ${what(next)} los` : ""}.`);

  // Dringende Aufgaben zuerst: überfällig und nächste 7 Tage
  const groups = groupTodos(todos, now);
  const urgent = groups.filter((g) => g.key === "overdue" || g.key === "week").flatMap((g) => g.items);
  const open = groups.filter((g) => g.key !== "done").flatMap((g) => g.items).length;
  if (urgent.length)
    parts.push(
      `${urgent.length === 1 ? "Eine Aufgabe steht" : `${urgent.length} Aufgaben stehen`} an: ${joinDe(urgent.slice(0, 3).map((t) => `${t.title}, fällig ${dueLabel(t.due!, now)}`))}.`,
    );
  else if (open) parts.push(`Du hast ${open === 1 ? "eine offene Aufgabe" : `${open} offene Aufgaben`}, nichts davon drängt.`);

  const due = countDue(cards, newLeft, now);
  if (due.learning + due.review >= 10) parts.push(`Ausserdem warten ${due.learning + due.review} Karteikarten auf dich.`);
  parts.push("Was hast du vor?");
  return parts.join(" ");
}
