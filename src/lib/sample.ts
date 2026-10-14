import type { Notes, Study } from "./schema";

// Beispielvorlesung, damit man die App ohne API-Schlüssel ausprobieren kann.
export const SAMPLE_NOTES: Notes = {
  title: "Angebot, Nachfrage und Marktgleichgewicht",
  course: "Mikroökonomie I",
  overview:
    "Die Vorlesung führt das **Marktmodell** ein: Wie Nachfrage und Angebot entstehen, wie sich daraus ein Gleichgewichtspreis bildet und wie Märkte auf Veränderungen reagieren. Am Ende steht die **Preiselastizität** als Maß dafür, wie stark die Nachfrage auf Preisänderungen reagiert.",
  learning_goals: [
    "Nachfrage- und Angebotskurve erklären und ihre Steigung begründen",
    "Bewegungen auf der Kurve von Verschiebungen der Kurve unterscheiden",
    "Marktgleichgewicht rechnerisch und grafisch bestimmen",
    "Preiselastizität der Nachfrage berechnen und interpretieren",
  ],
  sections: [
    {
      title: "Die Nachfrage",
      slides: "Folie 2–5",
      content:
        "Die **Nachfrage** beschreibt, welche Menge eines Gutes Konsumenten zu verschiedenen Preisen kaufen wollen und können, ceteris paribus (alle anderen Einflüsse bleiben gleich).\n\n### Gesetz der Nachfrage\nSteigt der Preis eines Gutes, sinkt die nachgefragte Menge. Die **Nachfragekurve** fällt deshalb von links oben nach rechts unten.\n\n> Ergänzung: Hinter dem Gesetz stehen zwei Effekte. Beim **Substitutionseffekt** weichen Konsumenten auf relativ günstigere Güter aus; beim **Einkommenseffekt** sinkt die Kaufkraft bei steigendem Preis.\n\n### Bewegung vs. Verschiebung\n| Ursache | Wirkung |\n|---|---|\n| Preis des Gutes ändert sich | Bewegung **auf** der Kurve |\n| Einkommen, Präferenzen, Preise anderer Güter, Erwartungen, Zahl der Käufer | Verschiebung **der** Kurve |\n\nBei **normalen Gütern** verschiebt ein höheres Einkommen die Kurve nach rechts, bei **inferioren Gütern** nach links.",
      key_points: [
        "Nachfragekurve fällt (Gesetz der Nachfrage)",
        "Preisänderung des Gutes: Bewegung auf der Kurve",
        "Alle anderen Faktoren: Verschiebung der Kurve",
      ],
      exam_hint:
        "Die Unterscheidung zwischen Bewegung auf der Kurve und Verschiebung der Kurve wird fast immer abgefragt, oft als Grafikaufgabe.",
    },
    {
      title: "Das Angebot",
      slides: "Folie 6–8",
      content:
        "Das **Angebot** beschreibt, welche Menge Produzenten zu verschiedenen Preisen verkaufen wollen. Nach dem **Gesetz des Angebots** steigt die angebotene Menge mit dem Preis, die **Angebotskurve** steigt also.\n\nVerschiebungen der Angebotskurve entstehen durch Inputpreise, Technologie, Erwartungen und die Zahl der Anbieter. Eine neue, effizientere Technologie verschiebt das Angebot nach rechts.",
      key_points: ["Angebotskurve steigt", "Technologie und Inputpreise verschieben die Angebotskurve"],
      exam_hint: "",
    },
    {
      title: "Marktgleichgewicht",
      slides: "Folie 9–12",
      content:
        "Im **Gleichgewicht** schneiden sich Angebots- und Nachfragekurve: Die angebotene Menge entspricht der nachgefragten Menge.\n\n$$Q^D(p^*) = Q^S(p^*)$$\n\n**Beispiel aus der Vorlesung:** $Q^D = 100 - 2p$ und $Q^S = 20 + 2p$. Gleichsetzen ergibt $100 - 2p = 20 + 2p$, also $p^* = 20$ und $Q^* = 60$.\n\nLiegt der Preis über $p^*$, entsteht ein **Angebotsüberschuss**, darunter ein **Nachfrageüberschuss**. Beide drängen den Preis zurück ins Gleichgewicht.",
      key_points: ["Gleichgewicht: $Q^D = Q^S$", "Überschüsse treiben den Preis zum Gleichgewicht"],
      exam_hint: "Rechenaufgaben mit linearen Kurven sind Standard. Immer auch die Menge $Q^*$ angeben.",
    },
    {
      title: "Preiselastizität der Nachfrage",
      slides: "Folie 13–16",
      content:
        "Die **Preiselastizität der Nachfrage** misst, um wie viel Prozent sich die nachgefragte Menge ändert, wenn sich der Preis um ein Prozent ändert.\n\n$$\\varepsilon = \\frac{\\Delta Q / Q}{\\Delta p / p}$$\n\n| Betrag | Bezeichnung |\n|---|---|\n| $|\\varepsilon| > 1$ | elastisch |\n| $|\\varepsilon| = 1$ | einheitselastisch |\n| $|\\varepsilon| < 1$ | unelastisch |\n\nBei unelastischer Nachfrage steigt der Umsatz, wenn der Preis steigt.",
      key_points: ["Elastizität = prozentuale Mengenänderung / prozentuale Preisänderung", "Unelastisch: Preiserhöhung steigert den Umsatz"],
      exam_hint: "Zusammenhang zwischen Elastizität und Umsatz wird gern als Verständnisfrage gestellt.",
    },
  ],
  slides: [
    { number: 1, title: "Angebot und Nachfrage", gist: "Titelfolie" },
    { number: 2, title: "Was ist Nachfrage?", gist: "Definition der Nachfrage, ceteris paribus" },
    { number: 3, title: "Gesetz der Nachfrage", gist: "Fallende Nachfragekurve" },
    { number: 4, title: "Verschiebungen", gist: "Determinanten der Nachfrage" },
    { number: 5, title: "Normale und inferiore Güter", gist: "Einkommenseffekt je nach Gutart" },
    { number: 6, title: "Was ist Angebot?", gist: "Definition, steigende Angebotskurve" },
    { number: 7, title: "Determinanten des Angebots", gist: "Inputpreise, Technologie, Erwartungen" },
    { number: 8, title: "Beispiel Technologie", gist: "Rechtsverschiebung durch Effizienz" },
    { number: 9, title: "Marktgleichgewicht", gist: "Schnittpunkt der Kurven" },
    { number: 10, title: "Rechenbeispiel", gist: "p* = 20, Q* = 60" },
    { number: 11, title: "Überschüsse", gist: "Angebots- und Nachfrageüberschuss" },
    { number: 12, title: "Anpassung", gist: "Preis kehrt ins Gleichgewicht zurück" },
    { number: 13, title: "Elastizität", gist: "Definition und Formel" },
    { number: 14, title: "Elastizitätsbereiche", gist: "elastisch, einheitselastisch, unelastisch" },
    { number: 15, title: "Elastizität und Umsatz", gist: "Umsatzwirkung von Preisänderungen" },
    { number: 16, title: "Zusammenfassung", gist: "Überblick über die Vorlesung" },
  ],
  glossary: [
    { term: "Ceteris paribus", definition: "Annahme, dass alle anderen Einflussgrößen unverändert bleiben." },
    { term: "Nachfrage", definition: "Menge eines Gutes, die Konsumenten zu verschiedenen Preisen kaufen wollen und können." },
    { term: "Inferiores Gut", definition: "Gut, dessen Nachfrage bei steigendem Einkommen sinkt." },
    { term: "Marktgleichgewicht", definition: "Preis-Mengen-Kombination, bei der angebotene und nachgefragte Menge übereinstimmen." },
    { term: "Preiselastizität", definition: "Prozentuale Mengenänderung im Verhältnis zur prozentualen Preisänderung." },
  ],
  formulas: [
    { name: "Gleichgewichtsbedingung", latex: "Q^D(p^*) = Q^S(p^*)", explanation: "Im Gleichgewicht sind nachgefragte und angebotene Menge gleich." },
    { name: "Preiselastizität der Nachfrage", latex: "\\varepsilon = \\frac{\\Delta Q / Q}{\\Delta p / p}", explanation: "$Q$: Menge, $p$: Preis, $\\Delta$: Änderung." },
  ],
  connections:
    "Das Marktmodell ist die Grundlage für alle folgenden Kapitel: Konsumententheorie (woher die Nachfrage kommt), Produktionstheorie (woher das Angebot kommt) und Wohlfahrtsanalyse.",
};

export const SAMPLE_STUDY: Study = {
  flashcards: [
    { front: "Was besagt das **Gesetz der Nachfrage**?", back: "Steigt der Preis eines Gutes, sinkt ceteris paribus die nachgefragte Menge.", topic: "Die Nachfrage", kind: "definition" },
    { front: "Was bedeutet *ceteris paribus*?", back: "Alle anderen Einflussgrößen bleiben unverändert.", topic: "Die Nachfrage", kind: "definition" },
    { front: "Der Preis eines Gutes steigt. Bewegung auf der Nachfragekurve oder Verschiebung?", back: "Bewegung **auf** der Kurve.", topic: "Die Nachfrage", kind: "konzept" },
    { front: "Nenne vier Faktoren, die die Nachfragekurve verschieben.", back: "Einkommen, Präferenzen, Preise anderer Güter, Erwartungen (außerdem: Zahl der Käufer).", topic: "Die Nachfrage", kind: "fakt" },
    { front: "Was ist ein **inferiores Gut**?", back: "Ein Gut, dessen Nachfrage bei steigendem Einkommen sinkt.", topic: "Die Nachfrage", kind: "definition" },
    { front: "Warum steigt die Angebotskurve?", back: "Bei höherem Preis lohnt sich die Produktion für mehr Anbieter bzw. größere Mengen.", topic: "Das Angebot", kind: "konzept" },
    { front: "Wie wirkt eine effizientere Technologie auf das Angebot?", back: "Die Angebotskurve verschiebt sich nach rechts.", topic: "Das Angebot", kind: "anwendung" },
    { front: "Gleichgewichtsbedingung", back: "$$Q^D(p^*) = Q^S(p^*)$$", topic: "Marktgleichgewicht", kind: "formel" },
    { front: "$Q^D = 100 - 2p$, $Q^S = 20 + 2p$. Gleichgewicht?", back: "$p^* = 20$, $Q^* = 60$", topic: "Marktgleichgewicht", kind: "anwendung" },
    { front: "Was entsteht, wenn der Preis über dem Gleichgewichtspreis liegt?", back: "Ein Angebotsüberschuss.", topic: "Marktgleichgewicht", kind: "konzept" },
    { front: "Formel der Preiselastizität der Nachfrage", back: "$$\\varepsilon = \\frac{\\Delta Q / Q}{\\Delta p / p}$$", topic: "Preiselastizität", kind: "formel" },
    { front: "Wann gilt die Nachfrage als **elastisch**?", back: "Wenn $|\\varepsilon| > 1$.", topic: "Preiselastizität", kind: "definition" },
    { front: "Nachfrage ist unelastisch. Was passiert mit dem Umsatz bei einer Preiserhöhung?", back: "Der Umsatz steigt, weil die Menge prozentual weniger sinkt als der Preis steigt.", topic: "Preiselastizität", kind: "anwendung" },
  ],
  quiz: [
    {
      kind: "single",
      question: "Das Einkommen der Haushalte steigt. Was passiert bei einem **inferioren** Gut?",
      options: ["Die Nachfragekurve verschiebt sich nach rechts", "Die Nachfragekurve verschiebt sich nach links", "Bewegung auf der Kurve nach unten", "Nichts"],
      correct: [1],
      model_answer: "Die Nachfragekurve verschiebt sich nach links.",
      explanation: "Bei inferioren Gütern sinkt die Nachfrage mit steigendem Einkommen. Eine Einkommensänderung verschiebt die Kurve; Bewegungen auf der Kurve entstehen nur durch den Preis des Gutes selbst.",
      topic: "Die Nachfrage",
      difficulty: "mittel",
    },
    {
      kind: "multi",
      question: "Welche Faktoren **verschieben** die Angebotskurve?",
      options: ["Neue Produktionstechnologie", "Preis des Gutes", "Höhere Rohstoffpreise", "Mehr Anbieter im Markt"],
      correct: [0, 2, 3],
      model_answer: "Technologie, Inputpreise und Zahl der Anbieter.",
      explanation: "Der Preis des Gutes selbst führt nur zu einer Bewegung auf der Angebotskurve.",
      topic: "Das Angebot",
      difficulty: "leicht",
    },
    {
      kind: "single",
      question: "$Q^D = 100 - 2p$, $Q^S = 20 + 2p$. Wie hoch ist die Gleichgewichtsmenge?",
      options: ["20", "40", "60", "80"],
      correct: [2],
      model_answer: "$Q^* = 60$",
      explanation: "Gleichsetzen: $100 - 2p = 20 + 2p \\Rightarrow p^* = 20$. Einsetzen: $Q^* = 100 - 40 = 60$. 20 ist der Preis, nicht die Menge.",
      topic: "Marktgleichgewicht",
      difficulty: "mittel",
    },
    {
      kind: "single",
      question: "Die Elastizität beträgt $\\varepsilon = -0{,}4$. Der Preis wird erhöht. Was passiert mit dem Umsatz?",
      options: ["Er steigt", "Er sinkt", "Er bleibt gleich", "Das lässt sich nicht sagen"],
      correct: [0],
      model_answer: "Der Umsatz steigt.",
      explanation: "$|\\varepsilon| < 1$: unelastisch. Die Menge sinkt prozentual weniger, als der Preis steigt, also steigt der Umsatz.",
      topic: "Preiselastizität",
      difficulty: "schwer",
    },
    {
      kind: "open",
      question: "Erkläre den Unterschied zwischen einer Bewegung auf der Nachfragekurve und einer Verschiebung der Nachfragekurve. Nenne je ein Beispiel.",
      options: [],
      correct: [],
      model_answer:
        "Eine **Bewegung auf der Kurve** entsteht ausschließlich durch eine Änderung des Preises des Gutes selbst (z. B. Kaffee wird teurer, es wird weniger Kaffee gekauft). Eine **Verschiebung der Kurve** entsteht, wenn sich ein anderer Einflussfaktor ändert, also Einkommen, Präferenzen, Preise anderer Güter, Erwartungen oder die Zahl der Käufer (z. B. steigendes Einkommen erhöht bei jedem Preis die Nachfrage nach Restaurantbesuchen).",
      explanation: "Kernpunkt: Der eigene Preis steht auf der Achse und bewegt nur entlang der Kurve.",
      topic: "Die Nachfrage",
      difficulty: "mittel",
    },
  ],
  exam_tasks: [
    {
      task: "Gegeben sind $Q^D = 120 - 3p$ und $Q^S = 4p - 20$.\n\na) Berechne Gleichgewichtspreis und -menge.\n\nb) Der Staat setzt einen Höchstpreis von $p = 15$ fest. Welche Situation entsteht und wie groß ist sie?",
      points: 8,
      model_answer:
        "a) $120 - 3p = 4p - 20 \\Rightarrow 140 = 7p \\Rightarrow p^* = 20$, $Q^* = 60$.\n\nb) Bei $p = 15$: $Q^D = 75$, $Q^S = 40$. Es entsteht ein **Nachfrageüberschuss** von $35$ Einheiten.",
      topic: "Marktgleichgewicht",
    },
    {
      task: "Ein Kino erhöht den Ticketpreis von 10 € auf 12 €. Die Besucherzahl sinkt von 500 auf 450. Berechne die Preiselastizität und beurteile, ob die Preiserhöhung den Umsatz steigert.",
      points: 6,
      model_answer:
        "$\\varepsilon = \\frac{-50/500}{2/10} = \\frac{-0{,}1}{0{,}2} = -0{,}5$. Unelastisch. Umsatz vorher $5000$ €, nachher $5400$ €: Der Umsatz steigt.",
      topic: "Preiselastizität",
    },
  ],
};
