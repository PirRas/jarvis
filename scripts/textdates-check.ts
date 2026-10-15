// Selbsttest Datumserkennung: npx tsx scripts/textdates-check.ts
import assert from "node:assert";
import { findDates } from "../src/lib/textDates";

const now = new Date(2026, 9, 14).getTime();
const hour = (t: number) => new Date(t).getHours();

// Mail-Absatz: zwei Sätze, je eigener Titel, eigene Uhrzeit, eigene Art
const mail = findDates("Die Prüfung Einführung in die Chemie findet am 19.01.2027 um 14:00 statt. Abgabe Praktikumsbericht bis 3. Dezember 2026.", now);
assert.equal(mail.length, 2);
assert.ok(mail[0].allDay && mail[0].kind === "deadline" && mail[0].title === "Abgabe Praktikumsbericht", mail[0].title);
assert.ok(!mail[1].allDay && hour(mail[1].start) === 14 && mail[1].kind === "exam");

// Zwei Daten in einem Satz: jedes nimmt die Uhrzeit dahinter; "Prof." trennt keinen Satz
const prof = findDates("Sprechstunde bei Prof. Müller am 20.10.2026 um 10:00 und am 27.10.2026 um 11:00.", now);
assert.deepEqual(prof.map((d) => hour(d.start)), [10, 11]);
assert.ok(prof[0].title.startsWith("Sprechstunde bei Prof. Müller"), prof[0].title);

// Zeitraum mit einer Uhrzeit am Ende: beide Tage bekommen sie
const block = findDates("Blockkurs 14.1.2027 – 15.1.2027, 9:00 Uhr", now);
assert.deepEqual(block.map((d) => hour(d.start)), [9, 9]);

console.log("textDates: alles ok");
