// Zeigt für jede Veranstaltung den üblichen Raum und alle Termine mit abweichendem Raum.
import { readFileSync } from "node:fs";
import { matchRoom } from "../src/lib/rooms";
import { templateSlots } from "../src/lib/pharmaTemplate";
import { occurrences, EMPTY_PLANNER, fmtShortDay, fmtTime } from "../src/lib/planner";

const dir = process.argv[2];
const slots = templateSlots("2. Zeitfenster");
const list = occurrences({ ...EMPTY_PLANNER, slots }, new Date(2026, 8, 14).getTime(), new Date(2026, 11, 19).getTime());
const seen = new Set<string>();
for (const o of list) {
  let data;
  try {
    data = JSON.parse(readFileSync(`${dir}/vv_${o.code}.json`, "utf8"));
  } catch {
    continue;
  }
  if (data.error) {
    if (!seen.has(o.code!)) console.log(o.code, "FEHLER", data.error), seen.add(o.code!);
    continue;
  }
  const r = matchRoom(o, data);
  const k = `${o.code}|${o.type}|${new Date(o.start).getDay()}`;
  if (!seen.has(k)) {
    seen.add(k);
    console.log(`${o.code} ${o.course.slice(0, 28).padEnd(28)} ${o.type.padEnd(22)} ->`, r.state === "found" ? `${r.regular}${r.alternatives.length ? ` (+${r.alternatives.length} Gruppen)` : ""}` : r.state);
  }
  if (r.state === "found" && r.changed) console.log(`   !! ${fmtShortDay(o.start)} ${fmtTime(o.start)}: ${r.room}  (sonst ${r.regular})`);
  if (r.state === "missing") console.log(`   ?? ${fmtShortDay(o.start)} ${fmtTime(o.start)}: nicht im Verzeichnis`);
}
