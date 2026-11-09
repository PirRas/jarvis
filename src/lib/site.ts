// Öffentliche Angaben zur Website (Suchmaschinen, Vorschaubilder, llms.txt, Impressum).
// Eigene Domain später über NEXT_PUBLIC_SITE_URL in Vercel setzen.

const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (vercelProd ? `https://${vercelProd}` : "https://nachbereitung.vercel.app")).replace(/\/$/, "");

export const SITE_NAME = "Jarvis";
export const SITE_TITLE = "Jarvis – Uni-Cockpit fürs Pharmaziestudium in Basel";
export const SITE_DESCRIPTION =
  "Kostenloses Uni-Cockpit für Studierende: Stundenplan mit Live-Räumen, Kalender, Prüfungen, KI-Nachbereitung von Vorlesungen, Karteikarten, Quiz und Sprachassistent.";

// Werte in Vercel setzen (Environment Variables), nicht in .env: die Datei ist eingecheckt.
export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME,
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS,
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
};

/** Öffentliche, indexierbare Seiten. Alles andere ist App mit privaten Daten (noindex, siehe next.config.ts). */
export const PUBLIC_PAGES = ["/", "/ueber", "/datenschutz", "/impressum"] as const;

/** Stand der öffentlichen Texte; beim Ändern von FEATURES/FAQ mitziehen. */
export const UPDATED = "2026-11-09";

export const FEATURES = [
  ["Stundenplan mit Live-Räumen", "Lektionen aus dem Kalender-Abo der Uni, Raumänderungen aus dem Vorlesungsverzeichnis der Universität Basel."],
  ["Kalender und Prüfungen", "Termine, Abgaben und Prüfungen an einem Ort, mit wiederkehrenden Terminen und Erinnerungen per Push."],
  ["Nachbereitung mit KI", "Aus den Folien einer Vorlesung entstehen Notizen mit Diagrammen, Strukturformeln und Abbildungen."],
  ["Karteikarten und Quiz", "Wiederholung nach Plan, Quiz mit KI-Korrektur offener Antworten und mögliche Prüfungsaufgaben."],
  ["Lernplan", "Jarvis verteilt die Nachbereitung auf freie Zeiten und plant um, wenn etwas dazwischenkommt."],
  ["Sprachassistent", "Frag Jarvis nach deinem Tag, lass Termine und Aufgaben anlegen oder die Nachbereitung verschieben."],
  ["Pharmazie-Werkzeuge", "Pharmakokinetik-Rechner, Stoffsuche mit Strukturformeln und Literatursuche mit Zitat."],
  ["Auf allen Geräten", "Im Browser, als installierbare Web-App und als Android-App, mit Abgleich über ein optionales Konto."],
] as const;

export const FAQ = [
  {
    q: "Was ist Jarvis?",
    a: "Jarvis ist ein kostenloses Uni-Cockpit im Browser und als Android-App. Es bündelt Stundenplan, Kalender, Prüfungen, Aufgaben, Links und die Nachbereitung von Vorlesungen an einem Ort.",
  },
  {
    q: "Für wen ist Jarvis gedacht?",
    a: "Für Studierende der Pharmazeutischen Wissenschaften an der Universität Basel. Stundenplan und Raumsuche nutzen das Vorlesungsverzeichnis der Uni Basel, die übrigen Funktionen passen auch zu anderen Studiengängen.",
  },
  {
    q: "Wie hilft Jarvis bei der Nachbereitung?",
    a: "Du lädst die Folien einer Vorlesung hoch. Jarvis erstellt daraus Notizen mit Diagrammen und Strukturformeln, Karteikarten mit Wiederholungsplan, ein Quiz mit KI-Korrektur und mögliche Prüfungsaufgaben.",
  },
  {
    q: "Was kostet Jarvis?",
    a: "Nichts. Jarvis hat keine Werbung und kein Tracking. Für die KI-Aufbereitung nutzt du deinen eigenen kostenlosen Schlüssel für Google Gemini.",
  },
  {
    q: "Wo liegen meine Daten?",
    a: "Zuerst im Browser deines Geräts. Nur wenn du ein Konto anlegst, gleicht Jarvis die Daten über Supabase zwischen deinen Geräten ab. Andere Nutzerinnen und Nutzer sehen sie nie.",
  },
  {
    q: "Kann ich mit Jarvis sprechen?",
    a: "Ja. Der Sprachassistent beantwortet Fragen zu deinem Tag, legt Termine und Aufgaben an und plant die Nachbereitung um, wenn du keine Zeit hast.",
  },
] as const;
