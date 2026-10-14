import { z } from "zod";
import { ALLOWED_SITES } from "./videoSites";
import { NotesSchema, StudySchema, VideosSchema, type Notes } from "./schema";

// Die Aufbereitung läuft über claude.ai mit dem eigenen Abo: Die App erzeugt die Prompts,
// das Ergebnis wird als JSON zurück in die App kopiert.

const schemaText = (schema: z.ZodType) => JSON.stringify(z.toJSONSchema(schema), null, 1);

const OUTPUT_RULES = `Ausgabeformat:
- Antworte ausschließlich mit einem einzigen JSON-Objekt, das exakt dem Schema unten entspricht. Kein Text davor oder danach.
- Gib das JSON in einem Codeblock aus (\`\`\`json … \`\`\`), damit ich es kopieren kann.
- Innerhalb der Strings ist Markdown erlaubt. Formeln in LaTeX ($...$ inline, $$...$$ abgesetzt); Backslashes im JSON korrekt escapen (\\\\frac statt \\frac).`;

export const NOTES_PROMPT_BASE = `Du bist ein erfahrener Tutor, der Vorlesungsfolien für Studierende nachbereitet. Im Anhang sind die Folien einer Vorlesung.

Ziel: Eine Nachbereitung, mit der man die Vorlesung vollständig verstehen und für die Prüfung lernen kann, ohne die Folien nochmals öffnen zu müssen.

Vollständigkeit hat oberste Priorität:
- Gehe die Folien der Reihe nach durch. Jede Folie erscheint in "slides", und jeder Inhalt jeder Folie findet sich in einem Abschnitt wieder: Definitionen, Aufzählungen, Beispiele, Zahlen, Formeln, Diagramme, Tabellen und Randbemerkungen.
- Beschreibe Abbildungen und Diagramme in Worten, sodass ihre Aussage ohne das Bild verständlich ist.
- Wo Folien nur Stichworte enthalten, formuliere sie aus und erkläre die Zusammenhänge. Kennzeichne Erklärungen, die über die Folien hinausgehen, als "> Ergänzung: …".
- Erfinde nichts, was der Vorlesung widerspricht.
- Schreibe in der Sprache der Folien (meist Deutsch). Hebe Fachbegriffe beim ersten Vorkommen **fett** hervor. Nutze ### Zwischenüberschriften, Listen und Tabellen, wo sie helfen.

${OUTPUT_RULES}

JSON-Schema:
${schemaText(NotesSchema)}`;

export const STUDY_PROMPT = `Erstelle jetzt aus denselben Folien Lernmaterial für die Prüfungsvorbereitung.

Karteikarten ("flashcards"):
- Decke jedes prüfungsrelevante Element ab: jede Definition, jedes Konzept, jede Formel, jedes Verfahren, jede wichtige Unterscheidung und jeden wichtigen Fakt. Faustregel: mindestens eine Karte pro inhaltlicher Folie.
- Eine Wissenseinheit pro Karte. Die Vorderseite ist eine eindeutige Frage, die Rückseite eine präzise, kurze Antwort.
- Mische Wissensfragen mit Verständnis- und Anwendungsfragen ("Warum…?", "Was passiert, wenn…?", "Worin unterscheiden sich…?").

Quiz ("quiz"):
- Mindestens 15 Fragen, bei umfangreichen Vorlesungen mehr, verteilt über alle Themen.
- Überwiegend single und multi, dazu einige open. Plausible Distraktoren, die typische Missverständnisse aufgreifen.
- "correct" enthält die Indizes (ab 0) der richtigen Optionen. Die Erklärung sagt, warum die richtige Antwort stimmt und warum die anderen falsch sind.

Klausuraufgaben ("exam_tasks"): 3 bis 6 Aufgaben im Stil einer Universitätsklausur mit vollständiger Musterlösung.

${OUTPUT_RULES}

JSON-Schema:
${schemaText(StudySchema)}`;

/** Prompt 1 mit den schon vorhandenen Fächern, damit Claude denselben Fachnamen wiederverwendet. */
export function notesPrompt(existingCourses: string[]) {
  if (!existingCourses.length) return NOTES_PROMPT_BASE;
  const list = existingCourses.map((c) => `- ${c}`).join("\n");
  return `${NOTES_PROMPT_BASE}

Fachname ("course"): Ich habe bereits Vorlesungen aus diesen Fächern gespeichert:
${list}
Gehört diese Vorlesung zu einem davon, übernimm den Namen exakt so, wie er dort steht. Sonst wähle einen neuen, sprechenden Namen.`;
}

/** Prompt 3: Erklärvideos suchen. Funktioniert im selben Chat oder in einem neuen, da die Themen mitgeliefert werden. */
export function videosPrompt(notes: Pick<Notes, "title" | "course" | "sections">) {
  const topics = notes.sections.map((s) => `- ${s.title}: ${s.key_points.slice(0, 3).join("; ")}`).join("\n");
  const many = notes.sections.length > 6;
  const sites = ALLOWED_SITES.map((s) => `${s.name} (${s.host})`).join(", ");
  return `Suche mit der Websuche passende Erklärvideos zu dieser Vorlesung, die beim Lernen für die Prüfung helfen.

Vorlesung: ${notes.title}
Fach: ${notes.course}
Themen:
${topics}

Anforderungen:
- ${many ? "Die Vorlesung hat viele Themen: wähle 4 bis 6 Videos, die zusammen die wichtigsten Themen abdecken." : "Wähle 2 bis 3 Videos, die zusammen die wichtigsten Themen abdecken."}
- Erlaubt sind ausschließlich diese Quellen: YouTube (Links der Form https://www.youtube.com/watch?v=… oder https://youtu.be/…) sowie die kostenlosen Lernplattformen ${sites}. Bei den Lernplattformen den direkten Link zur Seite mit dem Video angeben. Keine anderen Websites.
- Nur frei und kostenlos abspielbare Videos: keine Bezahlinhalte, keine Kanalmitgliedschaft, keine Videos, die eine Anmeldung, ein Abo oder eine Lizenz (z. B. einer Hochschule oder eines Verlags) brauchen.
- Sprache: Deutsch. Englisch nur, wenn es zu einem Thema kein gutes deutsches Video gibt. Keine anderen Sprachen (z. B. Spanisch), auch nicht mit Untertiteln.
- Gute, verständliche Erklärungen auf Hochschulniveau, z. B. von Hochschulen, bekannten Lernkanälen oder Dozierenden.
- Suche gezielt mit den deutschen Fachbegriffen, z. B. "site:studyflix.de <Begriff>" oder "site:youtube.com <Begriff> erklärt".
- Nimm nur Videos, die du über die Suche tatsächlich gefunden hast. Erfinde keine Links und keine Video-IDs. Wenn du für ein Thema nichts Passendes findest, lass es weg.

${OUTPUT_RULES}

JSON-Schema:
${schemaText(VideosSchema)}`;
}
