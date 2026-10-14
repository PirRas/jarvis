// Schnelltest: Datumserkennung mit dem Examensdaten-PDF und Stundenplan-Vorlage.
import { readFileSync } from "node:fs";
import { findDates } from "../src/lib/textDates";
import { templateSlots } from "../src/lib/pharmaTemplate";
import { occurrences, nowAndNext, EMPTY_PLANNER, fmtShortDay, fmtTime } from "../src/lib/planner";

const text = readFileSync(process.argv[2], "utf8");
for (const d of findDates(text, new Date(2026, 9, 14).getTime()).slice(0, 12)) {
  console.log(fmtShortDay(d.start), d.allDay ? "ganztägig" : fmtTime(d.start), d.kind.padEnd(8), "|", d.title);
}
const data = { ...EMPTY_PLANNER, slots: templateSlots("2. Zeitfenster") };
const now = new Date(2026, 9, 14, 16, 50).getTime();
const list = occurrences(data, now - 864e5, now + 7 * 864e5);
const { current, next } = nowAndNext(list, now);
console.log("jetzt:", current.map((o) => o.title), "als Nächstes:", next && `${fmtShortDay(next.start)} ${fmtTime(next.start)} ${next.title} [${next.code}]`);
console.log("27.11. (Dies):", occurrences(data, new Date(2026, 10, 27).getTime(), new Date(2026, 10, 28).getTime()).length, "Einträge");
