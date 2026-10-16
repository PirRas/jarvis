// Karteikarten-Stapel „Arzneipflanzen“: Bild erkennen, Familie und Droge, Inhaltsstoffe und Wirkung.

import type { Notes, Study } from "../schema";
import { PLANT_FAMILIES, PLANTS, type Plant } from "./plants";

export const PLANT_DECK_ID = "arzneipflanzen-v1";
export const PLANT_COURSE = "Organisation und Systematik der Arznei- und Giftpflanzen";

const name = (p: Plant) => `*${p.latin}* (${p.german})`;

/** Deterministischer Zufall, damit der Stapel auf jedem Gerät gleich aussieht. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export function plantDeck(): { notes: Notes; study: Study } {
  const families = PLANT_FAMILIES.map((f) => ({ family: f, plants: PLANTS.filter((p) => p.family === f) }));

  const notes: Notes = {
    title: "Arzneipflanzen und Giftpflanzen",
    course: PLANT_COURSE,
    overview: `${PLANTS.length} wichtige Arznei- und Giftpflanzen mit Familie, Droge, Hauptinhaltsstoffen und Anwendung bzw. Giftwirkung. Die Bilder stammen aus Wikipedia/Wikimedia Commons.`,
    learning_goals: [
      "Wichtige Arznei- und Giftpflanzen am Bild erkennen",
      "Pflanzen ihrer Familie zuordnen",
      "Droge, Hauptinhaltsstoffe und Anwendung bzw. Giftwirkung nennen",
    ],
    sections: families.map(({ family, plants }) => ({
      title: family,
      slides: "",
      content: plants
        .map((p) => `### ${p.latin} (${p.german})${p.toxic ? ", giftig" : ""}\n\n![](${p.image})\n\n- **Droge:** ${p.part}\n- **Inhaltsstoffe:** ${p.constituents}\n- **Anwendung / Wirkung:** ${p.use}`)
        .join("\n\n"),
      key_points: plants.map((p) => `${p.latin}: ${p.constituents}`),
      exam_hint: "",
    })),
    slides: [],
    glossary: [],
    formulas: [],
    connections: "Die Familie verrät oft die Inhaltsstoffgruppe: Solanaceae → Tropanalkaloide, Lamiaceae und Apiaceae → ätherische Öle, Plantaginaceae (Digitalis) und Apocynaceae → herzwirksame Glykoside.",
  };

  const flashcards: Study["flashcards"] = [];
  for (const p of PLANTS) {
    flashcards.push({
      front: `![](${p.image})\n\nWelche Pflanze ist das?`,
      back: `**${p.latin}** (${p.german})\n\nFamilie: ${p.family}${p.toxic ? "\n\n**Giftig**" : ""}`,
      topic: p.family,
      kind: "fakt",
    });
    flashcards.push({
      front: `Zu welcher Familie gehört ${name(p)}, und welcher Pflanzenteil wird verwendet?`,
      back: `**${p.family}**\n\nDroge: ${p.part}`,
      topic: p.family,
      kind: "fakt",
    });
    flashcards.push({
      front: `Hauptinhaltsstoffe und Anwendung bzw. Giftwirkung von ${name(p)}?`,
      back: `**${p.constituents}**\n\n${p.use}`,
      topic: p.family,
      kind: "fakt",
    });
  }

  // Quiz: Familie zuordnen, mit drei falschen Familien als Auswahl
  const rand = seeded(42);
  const quiz: Study["quiz"] = PLANTS.slice(0)
    .sort(() => rand() - 0.5)
    .slice(0, 25)
    .map((p) => {
      const wrong = PLANT_FAMILIES.filter((f) => f !== p.family)
        .sort(() => rand() - 0.5)
        .slice(0, 3);
      const options = [...wrong, p.family].sort(() => rand() - 0.5);
      return {
        kind: "single" as const,
        question: `Zu welcher Familie gehört ${name(p)}?`,
        options,
        correct: [options.indexOf(p.family)],
        model_answer: p.family,
        explanation: `${p.latin} gehört zu den ${p.family}. Inhaltsstoffe: ${p.constituents}.`,
        topic: p.family,
        difficulty: "mittel" as const,
      };
    });

  return { notes, study: { flashcards, quiz, exam_tasks: [] } };
}
