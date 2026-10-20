import { z } from "zod";

// Teil 1: die inhaltliche Nachbereitung der Vorlesung.
export const NotesSchema = z.object({
  title: z.string().describe("Prägnanter Titel der Vorlesung bzw. des Foliensatzes"),
  course: z
    .string()
    .describe("Name des Fachs / Moduls, falls erkennbar, sonst ein sinnvoller Oberbegriff"),
  overview: z
    .string()
    .describe("Worum geht es? 3–6 Sätze in Markdown, die den roten Faden der Vorlesung erklären"),
  learning_goals: z
    .array(z.string())
    .describe("Was man nach dieser Vorlesung können bzw. wissen muss, als konkrete Lernziele"),
  sections: z
    .array(
      z.object({
        title: z.string(),
        slides: z.string().describe("Folienbereich, z. B. 'Folie 4–9'"),
        content: z
          .string()
          .describe(
            "Ausführliche Nachbereitung in Markdown: alle Inhalte der Folien, ausformuliert und erklärt. Formeln in LaTeX mit $...$ bzw. $$...$$. Eigene Ergänzungen, die nicht auf den Folien stehen, als '> Ergänzung: ...' kennzeichnen. Wo es dem Verständnis hilft: Mermaid-Diagramm als ```mermaid-Codeblock oder Strukturformel als ![Strukturformel von X](pubchem:<englischer Name>) oder eine Abbildung aus Wikimedia Commons als ![Beschreibung](wiki:<englischer Suchbegriff>).",
          ),
        key_points: z.array(z.string()).describe("Die wichtigsten Aussagen dieses Abschnitts"),
        exam_hint: z
          .string()
          .describe("Was hiervon ist typischerweise prüfungsrelevant und worauf muss man achten? Leer, wenn nichts Besonderes."),
      }),
    )
    .describe("Thematische Abschnitte in Folienreihenfolge, die zusammen ALLE Folien abdecken"),
  slides: z
    .array(
      z.object({
        number: z.number().int(),
        title: z.string(),
        gist: z.string().describe("Kerninhalt der Folie in 1–2 Sätzen"),
      }),
    )
    .describe("Vollständige Folienliste: genau ein Eintrag pro Folie, auch für Titel-, Gliederungs- und Bildfolien"),
  glossary: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .describe("Alle Fachbegriffe der Vorlesung mit präziser Definition"),
  formulas: z
    .array(z.object({ name: z.string(), latex: z.string(), explanation: z.string() }))
    .describe("Alle Formeln/Gleichungen (LaTeX ohne $-Zeichen) mit Erklärung der Variablen. Leer, wenn keine vorkommen."),
  connections: z
    .string()
    .describe("Markdown: Wie hängen die Themen zusammen, und welche Vorkenntnisse werden vorausgesetzt?"),
});

// Teil 2: Lernmaterial für Prüfung und Wiederholung.
export const StudySchema = z.object({
  flashcards: z
    .array(
      z.object({
        front: z.string().describe("Frage oder Begriff, Markdown erlaubt"),
        back: z.string().describe("Präzise Antwort, Markdown/LaTeX erlaubt"),
        topic: z.string().describe("Abschnitt/Thema, zu dem die Karte gehört"),
        kind: z.enum(["definition", "konzept", "anwendung", "formel", "fakt"]),
      }),
    )
    .describe("Karteikarten: eine Wissenseinheit pro Karte, gemeinsam decken sie alle prüfungsrelevanten Inhalte ab"),
  quiz: z
    .array(
      z.object({
        kind: z.enum(["single", "multi", "open"]).describe("single = eine richtige Antwort, multi = mehrere richtig, open = freie Antwort"),
        question: z.string(),
        options: z.array(z.string()).describe("Antwortoptionen (bei 'open' leer)"),
        correct: z.array(z.number().int()).describe("Indizes der richtigen Optionen (bei 'open' leer)"),
        model_answer: z.string().describe("Musterlösung, bei 'open' ausführlich, sonst kurz"),
        explanation: z.string().describe("Warum ist das richtig, und warum sind die anderen Optionen falsch?"),
        topic: z.string(),
        difficulty: z.enum(["leicht", "mittel", "schwer"]),
      }),
    )
    .describe("Quizfragen mit plausiblen Distraktoren, gemischt aus allen Abschnitten"),
  exam_tasks: z
    .array(
      z.object({
        task: z.string().describe("Aufgabe im Klausurstil, Markdown/LaTeX"),
        points: z.number().int(),
        model_answer: z.string().describe("Vollständige Musterlösung mit Lösungsweg"),
        topic: z.string(),
      }),
    )
    .describe("Realistische Klausuraufgaben, die mehrere Konzepte verbinden"),
});

// Teil 3 (optional): passende Erklärvideos, per Websuche auf claude.ai gefunden.
export const VideoSchema = z.object({
  title: z.string().describe("Titel des Videos, genau wie auf der Plattform"),
  url: z.string().describe("Vollständige, tatsächlich gefundene URL auf YouTube oder einer der erlaubten Lernplattformen"),
  channel: z.string().describe("Kanal bzw. Urheber"),
  topic: z.string().describe("Welches Thema der Vorlesung das Video erklärt"),
  reason: z.string().describe("Ein Satz, warum dieses Video gut zum Thema passt"),
  language: z.string().describe("Sprache des Videos: Deutsch oder Englisch"),
});
export const VideosSchema = z.object({
  videos: z.array(VideoSchema).describe("2–3 Videos, bei vielen Themen bis zu 6"),
});
export type Video = z.infer<typeof VideoSchema>;

export type Notes = z.infer<typeof NotesSchema>;
export type Study = z.infer<typeof StudySchema>;
export type Flashcard = Study["flashcards"][number];
export type QuizQuestion = Study["quiz"][number];

/**
 * Liest die von Claude kopierte Antwort ein: entfernt Codeblock-Zeichen und Text drumherum,
 * prüft gegen das Schema und liefert verständliche Fehlermeldungen.
 */
export function parseClaudeJson<S extends z.ZodType>(
  raw: string,
  schema: S,
): { ok: true; data: z.infer<S> } | { ok: false; error: string } {
  // Codeblock-Zeilen entfernen (auch mitten im Text, falls eine Antwort mit „weiter“ fortgesetzt wurde).
  raw = raw.replace(/^\s*```[a-z]*\s*$/gim, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1) return { ok: false, error: "Im eingefügten Text steht kein JSON. Kopiere den kompletten Codeblock aus Claudes Antwort." };
  if (end < start)
    return { ok: false, error: "Das JSON ist unvollständig. Vermutlich wurde Claudes Antwort abgeschnitten: Schreib im Chat „weiter“ und füge beide Teile zusammen ein." };

  let value: unknown;
  const json = raw.slice(start, end + 1);
  try {
    try {
      value = JSON.parse(json);
    } catch {
      // KI vergisst bei LaTeX manchmal einen Backslash ("\Delta" statt "\\Delta"): ungültige Escapes verdoppeln.
      // Mermaid-Blöcke stehen immer in einem String: dort unmaskierte Anführungszeichen (A["…"]) escapen.
      const fixed = json
        .replace(/\\([^])/g, (m, c: string) => (`"\\/bfnrtu`.includes(c) ? m : "\\" + m))
        .replace(/```mermaid[\s\S]*?```/g, (block) => block.replace(/(?<!\\)"/g, '\\"'));
      value = JSON.parse(fixed);
    }
  } catch (e) {
    const msg = (e as Error).message;
    return {
      ok: false,
      error: `Das JSON ist fehlerhaft (${msg}). Wurde die Antwort abgeschnitten? Dann schreib im Chat „weiter“. Sonst bitte Claude: „Gib das JSON nochmal vollständig und gültig aus.“`,
    };
  }

  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const issues = result.error.issues
    .slice(0, 4)
    .map((i) => `„${i.path.join(".") || "(Wurzel)"}“: ${i.message}`)
    .join("; ");
  return { ok: false, error: `Das JSON passt nicht zum erwarteten Aufbau: ${issues}. Bitte Claude, das Schema genau einzuhalten.` };
}
