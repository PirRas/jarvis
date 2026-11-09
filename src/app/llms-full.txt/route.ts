import { FAQ, FEATURES, OPERATOR, SITE_DESCRIPTION, SITE_NAME, SITE_URL, UPDATED } from "@/lib/site";

export const dynamic = "force-static";

// Ausführliche Fassung von /llms.txt: alle öffentlichen Inhalte als Text, damit KI-Assistenten nichts rendern müssen.
export function GET() {
  const body = `# ${SITE_NAME} – vollständige Beschreibung

> ${SITE_DESCRIPTION}

Stand: ${UPDATED}
Adresse: ${SITE_URL}/
Sprache: Deutsch (Schweiz)

## Was Jarvis ist

Jarvis ist ein kostenloses Uni-Cockpit für Studierende der Pharmazeutischen Wissenschaften an der Universität Basel. Es läuft im Browser, als installierbare Web-App (PWA) und als Android-App. Jarvis bündelt Stundenplan, Kalender, Prüfungen, Aufgaben, Links und die Nachbereitung von Vorlesungen an einem Ort. Es gibt keine Werbung und kein Tracking.

${OPERATOR.name ? `Entwickelt von ${OPERATOR.name}, Student der Pharmazeutischen Wissenschaften an der Universität Basel.${OPERATOR.email ? ` Kontakt: ${OPERATOR.email}` : ""}\n\n` : ""}## Funktionen

${FEATURES.map(([title, text]) => `- **${title}:** ${text}`).join("\n")}

## Häufige Fragen

${FAQ.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}

## Datenschutz in Kürze

Vorlesungen, Karteikarten, Termine, Aufgaben und Gespräche mit Jarvis liegen im Browser des Geräts (IndexedDB). Nur mit einem optionalen Konto gleicht Jarvis die Daten über Supabase zwischen den eigenen Geräten ab; jede Person sieht nur ihre eigenen Daten. KI-Dienste (Google Gemini, ersatzweise OpenRouter) erhalten Daten nur auf Aktion der Nutzerin oder des Nutzers und mit deren eigenem Schlüssel. Details: ${SITE_URL}/datenschutz

## Öffentliche Seiten

- ${SITE_URL}/ – Überblick, Funktionen, häufige Fragen
- ${SITE_URL}/heute – die App selbst
- ${SITE_URL}/ueber – Funktionen und häufige Fragen
- ${SITE_URL}/datenschutz – Datenschutzerklärung
- ${SITE_URL}/impressum – Impressum

Alle übrigen Seiten zeigen persönliche Daten aus dem Browser und sind nicht für Suchmaschinen gedacht.
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
